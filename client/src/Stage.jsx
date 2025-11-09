import {
  usePlayer,
  usePlayers,
  useRound,
} from "@empirica/core/player/classic/react";
import { Loading } from "@empirica/core/player/react";
import React from "react";
import { Button } from "./components/Button";

export function Stage() {
  const player = usePlayer();
  const players = usePlayers();
  const round = useRound();

  if (player.stage.get("submit")) {
    if (players.length === 1) {
      return <Loading />;
    }

    return (
      <div className="text-center text-gray-400 pointer-events-none">
        Please wait for other player(s).
      </div>
    );
  }

  switch (round.get("task")) {
    case "roleReveal":
      return <RoleReveal />;
    default:
      return <div>Unknown task</div>;
  }
}

function RoleReveal() {
  const player = usePlayer();
  const players = usePlayers();

  const role = player.get("role");
  const gender = player.get("gender");

  const handleSubmit = () => {
    player.stage.set("submit", true);
  };

  // Fun role colors
  const roleColor = role === "A" ? "bg-purple-500" : "bg-teal-500";
  const roleEmoji = role === "A" ? "👑" : "⭐";

  return (
    <div className="w-full max-w-4xl p-8">
      <div className="text-center mb-8">
        <h1 className="text-5xl font-bold mb-4 animate-pulse">
          🎉 ROLE REVEAL PARTY! 🎉
        </h1>
        <p className="text-xl text-gray-600">
          Here's your totally important information:
        </p>
      </div>

      <div className={`${roleColor} rounded-3xl p-12 shadow-2xl text-white mb-8 transform hover:scale-105 transition-transform`}>
        <div className="text-center">
          <div className="text-8xl mb-4">{roleEmoji}</div>
          <h2 className="text-4xl font-bold mb-4">You are Role {role}!</h2>
          <p className="text-2xl mb-2">Gender: {gender}</p>
          <p className="text-lg opacity-80">
            {role === "A" ? "The Royal Leader" : "The Shining Star"}
          </p>
        </div>
      </div>

      <div className="bg-gray-100 rounded-xl p-6 mb-8">
        <h3 className="text-xl font-semibold mb-4">Other Players in Your Game:</h3>
        <div className="grid grid-cols-2 gap-4">
          {players.map((p) => (
            <div
              key={p.id}
              className={`p-4 rounded-lg ${p.id === player.id ? 'bg-yellow-200 border-2 border-yellow-400' : 'bg-white'}`}
            >
              <div className="font-medium">
                {p.id === player.id ? "👈 YOU!" : `Player ${p.id.slice(-4)}`}
              </div>
              <div className="text-sm text-gray-600">
                Role: {p.get("role")} | Gender: {p.get("gender")}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="text-center">
        <Button handleClick={handleSubmit}>
          <p className="text-lg">✨ I've Seen Enough Glory ✨</p>
        </Button>
      </div>
    </div>
  );
}
