import { EmpiricaClassic } from "@empirica/core/player/classic";
import { EmpiricaContext } from "@empirica/core/player/classic/react";
import { EmpiricaMenu, EmpiricaParticipant } from "@empirica/core/player/react";
import React from "react";
import { Game } from "./Game";
import { ExitSurvey } from "./intro-exit/ExitSurvey";
import { Introduction } from "./intro-exit/Introduction";
import { MyPlayerForm } from "./intro-exit/MyPlayerForm.jsx";
export default function App() {
  const urlParams = new URLSearchParams(window.location.search);
  let playerKey = urlParams.get("participantKey") || "";
  

  let urlUpdated = false;

  // If no participantKey, generate one and add to URL
  if (!playerKey) {
    playerKey = generateRandomKey(8);
    urlParams.set("participantKey", playerKey);
    urlUpdated = true;
  }

  // Update URL if needed
  if (urlUpdated) {
    const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
    window.history.replaceState({}, "", newUrl);
  }

  const { protocol, host } = window.location;
  const url = `${protocol}//${host}/query`;

  function generateRandomKey(length) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  function introSteps() {
    return [Introduction];
  }

  function exitSteps() {
    return [ExitSurvey];
  }

  return (
    <EmpiricaParticipant url={url} ns={playerKey} modeFunc={EmpiricaClassic}>
      <div className="h-screen relative">
        <EmpiricaMenu position="bottom-left" />
        <div className="h-full overflow-auto">
          <EmpiricaContext introSteps={introSteps} exitSteps={exitSteps} playerCreate={MyPlayerForm}>
            <Game />
          </EmpiricaContext>
        </div>
      </div>
    </EmpiricaParticipant>
  );
}
