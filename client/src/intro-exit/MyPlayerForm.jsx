import React, { useEffect } from "react";

export function MyPlayerForm({ onPlayerID }) {
  useEffect(() => {
    // Generate random alphanumeric player ID
    const generatePlayerID = () => {
      const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
      let result = "";
      for (let i = 0; i < 12; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
      }
      return result;
    };

    const playerID = generatePlayerID();
    onPlayerID(playerID);
  }, [onPlayerID]);

  return (
    <div className="h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-medium text-gray-900">Loading...</h2>
      </div>
    </div>
  );
}