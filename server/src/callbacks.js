import { ClassicListenersCollector } from "@empirica/core/admin/classic";
export const Empirica = new ClassicListenersCollector();

// Helper function to create waiting game
async function createWaitingGame(ctx, batch) {
  const games = Array.from(ctx.scopesByKind("game").values());
  const existingWaitingGame = games.find(g =>
    g.get("batchID") === batch.id &&
    g.get("isWaiting") === true
  );

  if (!existingWaitingGame) {
    // Create a waiting game for this batch with 1000 player capacity
    batch.addGame([
      {
        key: "treatment",
        value: { playerCount: 1000 }, // Large number so it never auto-starts
        immutable: true
      },
      { key: "isWaiting", value: true },
      { key: "name", value: "Waiting Room" }
    ]);
    console.log(`[BATCH] Created waiting game for batch ${batch.id}`);
  }
}

// Create waiting game when batch is created
Empirica.on("batch", async (ctx, { batch }) => {
  console.log(`[BATCH] Batch ${batch.id} created with status: ${batch.get("status")}`);

  const status = batch.get("status");
  if (status === "created" || status === "running") {
    await createWaitingGame(ctx, batch);
  }
});

// Also listen for status changes in case batch is started later
Empirica.on("batch", "status", async (ctx, { batch }) => {
  const status = batch.get("status");
  console.log(`[BATCH] Batch ${batch.id} status changed to: ${status}`);

  if (status === "created" || status === "running") {
    await createWaitingGame(ctx, batch);
  }
});

// Assign players to the waiting game so they can see the intro
Empirica.on("player", async (ctx, { player }) => {
  console.log(`[PLAYER] Player ${player.id} connected`);

  // Skip if player already assigned
  if (player.get("gameID")) {
    console.log(`[PLAYER] Player ${player.id} already has gameID: ${player.get("gameID")}`);
    return;
  }

  // Get running batches
  const batches = Array.from(ctx.scopesByKind("batch").values())
    .filter(b => b.get("status") === "running");

  if (batches.length === 0) {
    console.log(`[PLAYER] No running batches found for player ${player.id}`);
    return;
  }

  const batch = batches[0];

  // Check if there are any real (non-waiting) games available
  const allGames = Array.from(ctx.scopesByKind("game").values());
  const realGames = allGames.filter(g =>
    g.get("batchID") === batch.id &&
    g.get("isWaiting") !== true
  );

  if (realGames.length === 0) {
    console.log(`[PLAYER] No games available for player ${player.id}`);
    player.set("ended", "No games available");
    return;
  }

  // Find the waiting game for this batch (that hasn't ended)
  const waitingGame = allGames.find(g =>
    g.get("batchID") === batch.id &&
    g.get("isWaiting") === true &&
    !g.get("hasEnded")
  );

  if (!waitingGame) {
    console.log(`[PLAYER] No active waiting game found for batch ${batch.id}, creating new one`);
    // Create a new waiting game
    const newWaitingGame = batch.addGame([
      {
        key: "treatment",
        value: { playerCount: 1000 },
        immutable: true
      },
      { key: "isWaiting", value: true },
      { key: "name", value: "Waiting Room" }
    ]);
    console.log(`[PLAYER] Created new waiting game ${newWaitingGame.id}`);
    newWaitingGame.assignPlayer(player);
    return;
  }

  console.log(`[PLAYER] Assigning player ${player.id} to waiting game ${waitingGame.id}`);

  // Assign player to waiting game
  waitingGame.assignPlayer(player);
});

// When player completes intro or sets gender, try to assign them
Empirica.on("player", "introDone", async (ctx, { player }) => {
  if (!player.get("introDone")) return;

  const gender = player.get("gender");
  console.log(`[ASSIGNMENT] Player ${player.id} introDone fired (gender: ${gender})`);

  // If no gender yet, wait for it
  if (!gender) {
    console.log(`[ASSIGNMENT] Waiting for gender to be set for player ${player.id}`);
    return;
  }

  // Set wait start time if not already set
  if (!player.get("waitStartTime")) {
    player.set("waitStartTime", Date.now());
  }

  await tryAssignPlayers(ctx);
});

// Also trigger assignment when gender is set
Empirica.on("player", "gender", async (ctx, { player }) => {
  const gender = player.get("gender");
  const introDone = player.get("introDone");

  console.log(`[ASSIGNMENT] Player ${player.id} gender set to ${gender} (introDone: ${introDone})`);

  // Only try assignment if intro is also done
  if (introDone && gender) {
    // Set wait start time if not already set
    if (!player.get("waitStartTime")) {
      player.set("waitStartTime", Date.now());
    }
    await tryAssignPlayers(ctx);
  }
});

// Simple assignment: put 4 players into a game as soon as they're ready
async function tryAssignPlayers(ctx) {
  // Get all players ready for matching (intro done, gender set, in waiting games)
  const allGames = Array.from(ctx.scopesByKind("game").values());
  const waitingPlayers = Array.from(ctx.scopesByKind("player").values())
    .filter(p => {
      const game = allGames.find(g => g.id === p.get("gameID"));
      return p.get("introDone") &&
             p.get("gender") &&
             !p.get("ended") &&
             game &&
             game.get("isWaiting") === true;
    });

  console.log(`[ASSIGNMENT] Total players waiting: ${waitingPlayers.length}`);

  // Need at least 4 players
  if (waitingPlayers.length < 4) {
    console.log(`[ASSIGNMENT] Not enough players yet (need 4, have ${waitingPlayers.length})`);
    return;
  }

  // Count Role A players by gender across all started/ended games
  const completedGames = allGames.filter(g =>
    g.get("isWaiting") !== true &&
    (g.get("hasStarted") || g.get("hasEnded"))
  );

  let roleACounts = { male: 0, female: 0, other: 0 };

  for (const game of completedGames) {
    for (const player of game.players) {
      if (player.get("role") === "A") {
        const gender = player.get("gender");
        if (gender === "male") roleACounts.male++;
        else if (gender === "female") roleACounts.female++;
        else if (gender === "other") roleACounts.other++;
      }
    }
  }

  console.log(`[ASSIGNMENT] Role A counts across ${completedGames.length} games - Male: ${roleACounts.male}, Female: ${roleACounts.female}, Other: ${roleACounts.other}`);

  // Determine most over-represented gender in Role A
  // Always select one, even if all equal (never truly balanced)
  // Tie-breaking preference: male > female > other
  const maxCount = Math.max(roleACounts.male, roleACounts.female, roleACounts.other);
  const gendersWithMax = Object.entries(roleACounts).filter(([_, count]) => count === maxCount).map(([g, _]) => g);

  let mostOverrepresented;
  if (gendersWithMax.includes("male")) {
    mostOverrepresented = "male";
  } else if (gendersWithMax.includes("female")) {
    mostOverrepresented = "female";
  } else {
    mostOverrepresented = "other";
  }

  const isBalanced = false; // Never balanced - always enforce constraint

  console.log(`[ASSIGNMENT] Most over-represented in Role A: ${isBalanced ? 'BALANCED' : `${mostOverrepresented} (${maxCount})`}`);

  // Group waiting players by gender
  const genderGroups = {
    male: waitingPlayers.filter(p => p.get("gender") === "male"),
    female: waitingPlayers.filter(p => p.get("gender") === "female"),
    other: waitingPlayers.filter(p => p.get("gender") === "other"),
  };

  let selectedPlayers = [];
  let roleAGender = null;

  // Always select Role A from non-over-represented gender (constraint-based)
  console.log(`[ASSIGNMENT] Selecting Role A from non-${mostOverrepresented} genders`);

  // Find non-over-represented genders with at least 2 players
  // Prioritize most underrepresented (lowest count in Role A)
  const nonOverrepGenders = ["male", "female", "other"]
    .filter(g => g !== mostOverrepresented)
    .sort((a, b) => roleACounts[a] - roleACounts[b]); // Sort ascending by count

  for (const gender of nonOverrepGenders) {
    if (genderGroups[gender].length >= 2) {
      roleAGender = gender;
      console.log(`[ASSIGNMENT] Selected ${gender} for Role A (current count: ${roleACounts[gender]})`);
      break;
    }
  }

  if (!roleAGender) {
    console.log(`[ASSIGNMENT] Cannot form group: no non-${mostOverrepresented} gender has ≥2 players. Players will wait.`);

    // Calculate and print wait times
    const now = Date.now();
    const WAIT_THRESHOLD = 30 * 1000; // 30 seconds
    let maxWaitTime = 0;

    console.log(`[ASSIGNMENT] Current wait times:`);
    waitingPlayers.forEach(p => {
      const waitStart = p.get("waitStartTime");
      const waitTime = waitStart ? (now - waitStart) : 0; // in milliseconds
      maxWaitTime = Math.max(maxWaitTime, waitTime);
      console.log(`  Player ${p.id} (${p.get("gender")}): ${Math.round(waitTime / 1000)}s`);
    });

    // If anyone waited >30s, bypass constraint and take 4 longest-waiting
    if (maxWaitTime > WAIT_THRESHOLD) {
      console.log(`[ASSIGNMENT] Wait threshold exceeded (${Math.round(maxWaitTime / 1000)}s), forming group with 4 longest-waiting players`);
      selectedPlayers = waitingPlayers.slice(0, 4);

      // Determine roleAGender from the selected players
      // Take the gender of the first 2 players for Role A
      roleAGender = selectedPlayers[0].get("gender");
      console.log(`[ASSIGNMENT] Emergency assignment - Role A gender: ${roleAGender}`);

      // Continue to assignment (don't return)
    } else {
      return;
    }
  }

  // Only do normal selection if we haven't already selected (emergency case)
  if (selectedPlayers.length === 0) {
    // Take 2 longest-waiting from chosen gender for Role A
    const roleAPlayers = genderGroups[roleAGender].slice(0, 2);

    // Take next 2 longest-waiting from remaining players for Role B
    const remainingPlayers = waitingPlayers.filter(p => !roleAPlayers.includes(p));
    const roleBPlayers = remainingPlayers.slice(0, 2);

    selectedPlayers = [...roleAPlayers, ...roleBPlayers];

    // Verify we have 4 players
    if (selectedPlayers.length < 4) {
      console.log(`[ASSIGNMENT] Cannot form group: only ${selectedPlayers.length} players available`);
      return;
    }

    // Count over-represented gender in final group (should be ≤2)
    const overrepCount = selectedPlayers.filter(p => p.get("gender") === mostOverrepresented).length;
    console.log(`[ASSIGNMENT] Selected group: Role A=${roleAGender}, contains ${overrepCount} ${mostOverrepresented} players (max 2)`);
  }

  console.log(`[ASSIGNMENT] Selected 4 players for assignment`);

  // Find an open game (hasn't started, no players assigned)
  const batches = Array.from(ctx.scopesByKind("batch").values())
    .filter(b => b.get("status") === "running");

  if (batches.length === 0) {
    console.log(`[ASSIGNMENT] No running batches found`);
    return;
  }

  const batch = batches[0];

  const openGames = allGames.filter(g =>
    g.get("batchID") === batch.id &&
    !g.get("hasStarted") &&
    !g.get("hasEnded") &&
    g.get("isWaiting") !== true &&
    g.players.length === 0
  );

  if (openGames.length === 0) {
    console.log(`[ASSIGNMENT] No open games available in batch`);
    return;
  }

  const targetGame = openGames[0];

  // Store Role A gender on the game for onGameStart to use
  targetGame.set("roleAGender", roleAGender);

  console.log(`[ASSIGNMENT] Assigning to game ${targetGame.id}, Role A gender: ${roleAGender}`);

  // Assign players to the game
  for (const p of selectedPlayers) {
    await targetGame.assignPlayer(p);
    console.log(`[ASSIGNMENT] Assigned player ${p.id} (gender: ${p.get("gender")}) to game ${targetGame.id}`);
  }

  // Mark game as started so it counts in balance calculations immediately
  targetGame.set("hasStarted", true);
  console.log(`[ASSIGNMENT] Game ${targetGame.id} marked as started with ${targetGame.players.length} players`);
}

Empirica.onGameStart(({ game }) => {
  // Assign roles to players based on stored roleAGender
  const roleAGender = game.get("roleAGender");
  const players = game.players;

  // Take first 2 players matching roleAGender for Role A
  const roleAPlayers = players.filter(p => p.get("gender") === roleAGender).slice(0, 2);
  const roleBPlayers = players.filter(p => !roleAPlayers.includes(p));

  // Verify we have exactly 2+2
  if (roleAPlayers.length !== 2 || roleBPlayers.length !== 2) {
    console.log(`[GAME START] WARNING: Role assignment mismatch - ${roleAPlayers.length} A, ${roleBPlayers.length} B`);
  }

  roleAPlayers.forEach(player => {
    player.set("role", "A");
    console.log(`[GAME START] Assigned role A to player ${player.id} (gender: ${player.get("gender")})`);
  });

  roleBPlayers.forEach(player => {
    player.set("role", "B");
    console.log(`[GAME START] Assigned role B to player ${player.id} (gender: ${player.get("gender")})`);
  });

  // Create a simple round with one stage
  const round = game.addRound({
    name: "The Big Reveal",
    task: "roleReveal",
  });
  round.addStage({ name: "Party Time", duration: 120 });
});

Empirica.onRoundStart(() => {});

Empirica.onStageStart(() => {});

Empirica.onStageEnded(() => {});

Empirica.onRoundEnded(() => {});

Empirica.onGameEnded(() => {});
