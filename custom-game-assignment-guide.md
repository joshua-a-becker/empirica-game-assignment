# Custom Game Assignment in Empirica

This guide explains how to implement custom game assignment logic in Empirica experiments. Custom assignment gives you full control over which players are assigned to which games, allowing you to implement complex assignment strategies beyond the default behavior.

## Table of Contents

- [Overview](#overview)
- [When to Use Custom Assignment](#when-to-use-custom-assignment)
- [Basic Setup](#basic-setup)
- [Assignment Strategies](#assignment-strategies)
- [API Reference](#api-reference)
- [Common Use Cases](#common-use-cases)
- [Troubleshooting](#troubleshooting)

---

## Overview

By default, Empirica automatically assigns players to games when they connect. The custom assignment feature allows you to:

- Manually control which players are assigned to which games
- Implement conditional assignment logic based on player attributes
- Create custom matching algorithms (e.g., skill-based matching)
- Handle reassignment and replay scenarios
- Integrate with external systems for assignment decisions

---

## When to Use Custom Assignment

Consider using custom assignment when you need to:

- **Match players based on attributes** - Assign players with similar characteristics together
- **Implement waiting pools** - Hold players until a specific condition is met
- **Control assignment timing** - Delay assignment until certain criteria are satisfied
- **Handle dynamic reassignment** - Move players between games during the experiment
- **Integrate external logic** - Use external APIs or databases for assignment decisions
- **Create custom batch configurations** - Go beyond simple/complete batch types

---

## Basic Setup

### Step 1: Disable Automatic Assignment

In your `server/src/index.js` file, configure Classic with `disableAssignment`:

```javascript
import { ClassicListenersCollector } from "@empirica/core/admin/classic";
import { Classic } from "@empirica/core/admin/classic";

export const Empirica = new ClassicListenersCollector();

// Register callbacks
import "./callbacks.js";

export default function (ctx) {
  ctx.register(
    Classic({
      disableAssignment: true, // Disable automatic assignment
      disableIntroCheck: false, // Optional: keep intro check
    })
  );
}
```

### Step 2: Implement Custom Assignment Logic

In your `server/src/callbacks.js` file, implement assignment using the `player` event:

```javascript
import { Empirica } from "./index.js";

Empirica.on("player", async (ctx, { player }) => {
  // Your custom assignment logic here

  // 1. Get available games
  const games = Array.from(ctx.scopesByKind("game").values());

  // 2. Filter games based on your criteria
  const availableGames = games.filter(game => {
    return !game.get("hasEnded") &&
           !game.get("hasStarted") &&
           game.get("treatment").playerCount > game.players.length;
  });

  // 3. Select a game (your custom logic)
  const targetGame = availableGames[0]; // Simple example

  // 4. Assign player to game
  if (targetGame) {
    await targetGame.assignPlayer(player);
  }
});
```

---

## Assignment Strategies

### Strategy 1: Fill Games Sequentially

Assign players to games in order, filling each game before moving to the next:

```javascript
Empirica.on("player", async (ctx, { player }) => {
  // Skip if player already assigned
  if (player.get("gameID")) return;

  const games = Array.from(ctx.scopesByKind("game").values())
    .filter(g => !g.get("hasEnded") && !g.get("hasStarted"))
    .sort((a, b) => a.id.localeCompare(b.id)); // Sort by creation order

  for (const game of games) {
    const maxPlayers = game.get("treatment").playerCount;
    const currentPlayers = game.players.length;

    if (currentPlayers < maxPlayers) {
      await game.assignPlayer(player);
      break;
    }
  }
});
```

### Strategy 2: Random Assignment with Balancing

Balance players across games while assigning randomly:

```javascript
Empirica.on("player", async (ctx, { player }) => {
  if (player.get("gameID")) return;

  const games = Array.from(ctx.scopesByKind("game").values())
    .filter(g => !g.get("hasEnded") && !g.get("hasStarted"));

  // Find games with fewest players (prefer underassigned)
  const minPlayerCount = Math.min(...games.map(g => g.players.length));
  const underassignedGames = games.filter(g => g.players.length === minPlayerCount);

  // Randomly select from underassigned games
  const randomIndex = Math.floor(Math.random() * underassignedGames.length);
  const targetGame = underassignedGames[randomIndex];

  if (targetGame) {
    await targetGame.assignPlayer(player);
  }
});
```

### Strategy 3: Attribute-Based Matching

Match players based on shared attributes:

```javascript
Empirica.on("player", async (ctx, { player }) => {
  if (player.get("gameID")) return;

  const playerSkillLevel = player.get("skillLevel"); // Set during intro

  const games = Array.from(ctx.scopesByKind("game").values())
    .filter(g => !g.get("hasEnded") && !g.get("hasStarted"));

  // Find games with matching skill level
  const matchingGames = games.filter(game => {
    const gameSkillLevel = game.get("requiredSkillLevel");
    return gameSkillLevel === playerSkillLevel;
  });

  // Assign to first matching game with open slots
  for (const game of matchingGames) {
    const maxPlayers = game.get("treatment").playerCount;
    if (game.players.length < maxPlayers) {
      await game.assignPlayer(player);
      break;
    }
  }
});
```

### Strategy 4: Conditional Assignment with Waiting Pool

Hold players in a waiting pool until conditions are met:

```javascript
Empirica.on("player", async (ctx, { player }) => {
  if (player.get("gameID")) return;

  // Check if player meets assignment criteria
  const hasCompletedSurvey = player.get("surveyComplete");
  const agreedToTerms = player.get("termsAgreed");

  if (!hasCompletedSurvey || !agreedToTerms) {
    // Player stays in waiting pool
    player.set("waitingReason", "Please complete the survey and agree to terms");
    return;
  }

  // Player is ready, proceed with assignment
  const games = Array.from(ctx.scopesByKind("game").values())
    .filter(g => !g.get("hasEnded") && !g.get("hasStarted"));

  const availableGame = games.find(g => {
    const maxPlayers = g.get("treatment").playerCount;
    return g.players.length < maxPlayers;
  });

  if (availableGame) {
    await availableGame.assignPlayer(player);
    player.set("waitingReason", null);
  }
});
```

---

## API Reference

### Configuration Options

Configure the Classic module in `server/src/index.js`:

```javascript
Classic({
  // Disable automatic assignment (required for custom assignment)
  disableAssignment: boolean,

  // Disable automatic game start based on intro completion
  disableIntroCheck: boolean,

  // Disable automatic game creation when batch starts
  disableGameCreation: boolean,

  // Prevent batch from ending when all games complete
  disableBatchAutoend: boolean,

  // Prefer games with fewer players (used with default assignment)
  preferUnderassignedGames: boolean,

  // Never assign more players than playerCount allows
  neverOverbookGames: boolean,
})
```

### Core Methods

#### `game.assignPlayer(player)`

Assigns a player to a specific game.

```javascript
await game.assignPlayer(player);
```

**Parameters:**
- `player` (Player) - The player object to assign

**Returns:** Promise that resolves when assignment is complete

**Notes:**
- Can be called on unstarted or running games
- Handles reassignment automatically (removes from previous game)
- Updates player's `gameID`, `treatment`, and `treatmentName` attributes

#### `ctx.scopesByKind(kind)`

Get all scopes of a specific kind.

```javascript
const games = Array.from(ctx.scopesByKind("game").values());
const players = Array.from(ctx.scopesByKind("player").values());
const batches = Array.from(ctx.scopesByKind("batch").values());
```

**Parameters:**
- `kind` (string) - Scope kind: "game", "player", "batch", "round", "stage"

**Returns:** Map of scopes (convert to array with `Array.from(...values())`)

### Event Listeners

#### Listen for Player Creation

```javascript
Empirica.on("player", async (ctx, { player }) => {
  // Triggered when player is created
  // Use this for custom assignment logic
});
```

#### Listen for Attribute Changes

```javascript
Empirica.on("player", "attributeName", async (ctx, { player, attributeName }) => {
  // Triggered when specific attribute changes on player
  const newValue = player.get(attributeName);
});
```

#### Game Lifecycle Events

```javascript
Empirica.onGameStart(({ game }) => {
  // Triggered when game starts
});

Empirica.onGameEnded(({ game }) => {
  // Triggered when game ends
});
```

### Useful Player Attributes

```javascript
// Check player assignment status
const gameID = player.get("gameID"); // null if unassigned

// Check player intro status
const introDone = player.get("introDone"); // boolean

// Check if player has ended
const ended = player.get("ended"); // string reason or null

// Access participant ID
const participantID = player.get("participantID");

// Custom attributes (you can set these)
player.set("customAttribute", value);
const value = player.get("customAttribute");
```

### Useful Game Attributes

```javascript
// Check game status
const hasStarted = game.get("hasStarted"); // boolean
const hasEnded = game.get("hasEnded"); // boolean

// Access treatment factors
const treatment = game.get("treatment");
const playerCount = treatment.playerCount;

// Access game players
const players = game.players; // Array of Player objects

// Set custom game attributes
game.set("customAttribute", value);
```

---

## Common Use Cases

### Use Case 1: Replay/Reassignment

Allow players to replay the experiment by reassigning them to new games:

```javascript
// In callbacks.js

// Trigger reassignment when player requests replay
Empirica.on("player", "requestReplay", async (ctx, { player, requestReplay }) => {
  if (!requestReplay) return;

  // Clear previous game assignment
  player.set("gameID", null);
  player.set("ended", null);

  // Find next available game
  const batches = Array.from(ctx.scopesByKind("batch").values())
    .filter(b => b.get("status") === "running");

  for (const batch of batches) {
    const games = Array.from(ctx.scopesByKind("game").values())
      .filter(g => g.get("batchID") === batch.id && !g.get("hasEnded"));

    for (const game of games) {
      const maxPlayers = game.get("treatment").playerCount;
      if (game.players.length < maxPlayers) {
        await game.assignPlayer(player);
        player.set("requestReplay", false);
        return;
      }
    }
  }

  // No games available
  player.set("replayError", "No games available for replay");
  player.set("requestReplay", false);
});
```

### Use Case 2: Custom Batch Configuration

Create games programmatically based on custom batch config:

```javascript
// In callbacks.js

Empirica.on("batch", async (ctx, { batch }) => {
  const config = batch.get("config");

  if (config.kind !== "custom") return;

  // Your custom game creation logic
  const { numGames, playerCount, customFactors } = config;

  for (let i = 0; i < numGames; i++) {
    batch.addGame([
      {
        key: "treatment",
        value: {
          playerCount: playerCount,
          ...customFactors
        },
        immutable: true
      },
      { key: "gameIndex", value: i },
      { key: "customAttribute", value: "myValue" }
    ]);
  }
});
```

Then create a custom batch via the admin UI with:

```json
{
  "kind": "custom",
  "numGames": 10,
  "playerCount": 3,
  "customFactors": {
    "difficulty": "hard",
    "duration": 600
  }
}
```

### Use Case 3: Dynamic Game Creation

Create new games on-demand as players arrive:

```javascript
Empirica.on("player", async (ctx, { player }) => {
  if (player.get("gameID")) return;

  // Get running batches
  const batches = Array.from(ctx.scopesByKind("batch").values())
    .filter(b => b.get("status") === "running");

  if (batches.length === 0) return;

  const batch = batches[0]; // Use first running batch

  // Check for available games
  const games = Array.from(ctx.scopesByKind("game").values())
    .filter(g => g.get("batchID") === batch.id && !g.get("hasEnded"));

  const availableGame = games.find(g => {
    const maxPlayers = g.get("treatment").playerCount;
    return g.players.length < maxPlayers;
  });

  if (availableGame) {
    // Assign to existing game
    await availableGame.assignPlayer(player);
  } else {
    // Create new game
    const treatment = batch.get("config").treatments[0]; // Or your logic

    const newGame = batch.addGame([
      { key: "treatment", value: treatment.factors, immutable: true },
      { key: "treatmentName", value: treatment.name }
    ]);

    // Assign player to new game
    await newGame.assignPlayer(player);
  }
});
```

### Use Case 4: Skill-Based Matchmaking

Create matched games based on player skill ratings:

```javascript
Empirica.on("player", "skillRating", async (ctx, { player }) => {
  // Triggered when player's skill rating is set (e.g., after intro)
  if (player.get("gameID")) return;

  const playerRating = player.get("skillRating");
  if (!playerRating) return;

  // Find all unassigned players with ratings
  const allPlayers = Array.from(ctx.scopesByKind("player").values())
    .filter(p =>
      !p.get("gameID") &&
      p.get("skillRating") !== null &&
      !p.get("ended")
    )
    .sort((a, b) => a.get("skillRating") - b.get("skillRating"));

  // Need at least 2 players for a game
  const requiredPlayers = 4; // Or get from treatment
  if (allPlayers.length < requiredPlayers) return;

  // Group players into skill brackets
  const brackets = [];
  for (let i = 0; i < allPlayers.length; i += requiredPlayers) {
    brackets.push(allPlayers.slice(i, i + requiredPlayers));
  }

  // Create games for complete brackets
  const batches = Array.from(ctx.scopesByKind("batch").values())
    .filter(b => b.get("status") === "running");

  if (batches.length === 0) return;
  const batch = batches[0];

  for (const bracket of brackets) {
    if (bracket.length < requiredPlayers) continue;

    // Create game for this bracket
    const avgRating = bracket.reduce((sum, p) => sum + p.get("skillRating"), 0) / bracket.length;

    const game = batch.addGame([
      { key: "treatment", value: { playerCount: requiredPlayers }, immutable: true },
      { key: "averageSkillRating", value: avgRating }
    ]);

    // Assign all players in bracket
    for (const p of bracket) {
      await game.assignPlayer(p);
    }
  }
});
```

### Use Case 5: Treatment-Specific Assignment

Assign players to games based on their assigned treatment:

```javascript
Empirica.on("player", async (ctx, { player }) => {
  if (player.get("gameID")) return;

  // Player receives treatment assignment during intro
  const assignedTreatment = player.get("assignedTreatment");
  if (!assignedTreatment) return;

  // Find games matching the player's treatment
  const games = Array.from(ctx.scopesByKind("game").values())
    .filter(g => {
      if (g.get("hasEnded") || g.get("hasStarted")) return false;

      const gameTreatment = g.get("treatmentName");
      return gameTreatment === assignedTreatment;
    });

  // Assign to first available game with matching treatment
  for (const game of games) {
    const maxPlayers = game.get("treatment").playerCount;
    if (game.players.length < maxPlayers) {
      await game.assignPlayer(player);
      break;
    }
  }

  // No matching game available
  if (!player.get("gameID")) {
    player.set("waitingReason", `Waiting for ${assignedTreatment} game`);
  }
});
```

---

## Troubleshooting

### Players Not Being Assigned

**Problem:** Players remain in lobby without being assigned to games.

**Solutions:**

1. **Check that `disableAssignment: true` is set:**
   ```javascript
   ctx.register(Classic({ disableAssignment: true }));
   ```

2. **Verify your `player` event listener is registered:**
   ```javascript
   Empirica.on("player", async (ctx, { player }) => {
     console.log("Player event triggered:", player.id);
     // Your assignment logic
   });
   ```

3. **Check if games are available:**
   ```javascript
   const games = Array.from(ctx.scopesByKind("game").values());
   console.log("Available games:", games.length);
   ```

4. **Ensure you're calling `await game.assignPlayer(player)`:**
   ```javascript
   if (targetGame) {
     await targetGame.assignPlayer(player); // Don't forget 'await'
   }
   ```

### Players Assigned Multiple Times

**Problem:** Players are assigned to multiple games or reassigned unexpectedly.

**Solutions:**

1. **Check player's current assignment before assigning:**
   ```javascript
   if (player.get("gameID")) {
     console.log("Player already assigned to game:", player.get("gameID"));
     return; // Skip assignment
   }
   ```

2. **Be careful with attribute listeners:**
   ```javascript
   // This triggers on EVERY attribute change
   Empirica.on("player", async (ctx, { player }) => {
     // Will run many times!
   });

   // Better: Listen to specific attribute
   Empirica.on("player", "readyForAssignment", async (ctx, { player }) => {
     // Only runs when readyForAssignment changes
   });
   ```

### Games Not Starting

**Problem:** Players are assigned but games don't start.

**Solutions:**

1. **Check if `disableIntroCheck` is set correctly:**
   ```javascript
   // If you want automatic start after intro:
   ctx.register(Classic({
     disableAssignment: true,
     disableIntroCheck: false // Let Empirica handle game start
   }));
   ```

2. **Verify all players completed intro:**
   ```javascript
   const allIntroComplete = game.players.every(p => p.get("introDone"));
   console.log("All intros complete:", allIntroComplete);
   ```

3. **Manually start game if needed:**
   ```javascript
   if (readyToStart) {
     game.set("start", true);
   }
   ```

### Assignment Logic Not Triggering

**Problem:** Custom assignment code doesn't run when expected.

**Solutions:**

1. **Check event listener syntax:**
   ```javascript
   // Correct:
   Empirica.on("player", async (ctx, { player }) => { });

   // Incorrect:
   Empirica.on("player", (player) => { }); // Missing ctx parameter
   ```

2. **Ensure callbacks.js is imported in index.js:**
   ```javascript
   // In index.js
   import "./callbacks.js"; // Must be after Empirica initialization
   ```

3. **Add logging to verify execution:**
   ```javascript
   Empirica.on("player", async (ctx, { player }) => {
     console.log("[ASSIGNMENT] Player created:", player.id);
     // Your logic
   });
   ```

### Custom Batch Not Creating Games

**Problem:** Custom batch configuration doesn't create games.

**Solutions:**

1. **Listen for batch event:**
   ```javascript
   Empirica.on("batch", async (ctx, { batch }) => {
     console.log("Batch created:", batch.id);
     const config = batch.get("config");
     console.log("Batch config:", config);

     if (config.kind === "custom") {
       // Create games here
     }
   });
   ```

2. **Verify config structure:**
   ```javascript
   // Custom batch config must have "kind": "custom"
   {
     "kind": "custom",
     "yourCustomField": "value"
   }
   ```

3. **Check game creation syntax:**
   ```javascript
   batch.addGame([
     {
       key: "treatment",
       value: { playerCount: 2 },
       immutable: true  // Required for treatment
     }
   ]);
   ```

---

## Additional Resources

- **Empirica Documentation:** https://docs.empirica.ly/
- **Classic API Reference:** Check `/lib/@empirica/core/src/admin/classic/` in your Empirica installation
- **Example Code:** `/tests/stress/experiment/server/src/callbacks.js` for replay example
- **Template Code:** `/internal/templates/source/callbacks/src/callbacks.js` for starter template

---

## Summary

Custom game assignment in Empirica gives you complete control over player-to-game matching. The key steps are:

1. **Disable automatic assignment** with `disableAssignment: true`
2. **Listen for player events** using `Empirica.on("player", ...)`
3. **Implement your assignment logic** using `game.assignPlayer(player)`
4. **Test thoroughly** with different player arrival patterns

With custom assignment, you can implement sophisticated matching algorithms, conditional assignment, dynamic game creation, and more. Experiment with different strategies to find what works best for your research needs.
