import React, { useState, useEffect } from "react";
import { usePlayer } from "@empirica/core/player/classic/react";
import { Button } from "../components/Button";

export function Introduction({ next }) {
  const player = usePlayer();
  const [gender, setGender] = useState("");

  // Set playerIdentifier from URL when component loads
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const playerIdentifier = urlParams.get("playerIdentifier");
    if (playerIdentifier && player) {
      player.set("playerIdentifier", playerIdentifier);
    }
  }, [player]);

  const handleSubmit = () => {
    if (gender) {
      player.set("gender", gender);
      next();
    }
  };

  return (
    <div className="mt-3 sm:mt-5 p-20">
      <h3 className="text-lg leading-6 font-medium text-gray-900">
        Demographic Survey
      </h3>
      <div className="mt-2 mb-6">
        <p className="text-sm text-gray-500 mb-4">
          Please answer the following question before continuing.
        </p>

        <div className="mt-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            What is your gender?
          </label>
          <div className="space-y-2">
            <div>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  className="form-radio h-4 w-4"
                  name="gender"
                  value="male"
                  checked={gender === "male"}
                  onChange={(e) => setGender(e.target.value)}
                />
                <span className="ml-2">Male</span>
              </label>
            </div>
            <div>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  className="form-radio h-4 w-4"
                  name="gender"
                  value="female"
                  checked={gender === "female"}
                  onChange={(e) => setGender(e.target.value)}
                />
                <span className="ml-2">Female</span>
              </label>
            </div>
            <div>
              <label className="inline-flex items-center">
                <input
                  type="radio"
                  className="form-radio h-4 w-4"
                  name="gender"
                  value="other"
                  checked={gender === "other"}
                  onChange={(e) => setGender(e.target.value)}
                />
                <span className="ml-2">Other</span>
              </label>
            </div>
          </div>
        </div>
      </div>
      <Button handleClick={handleSubmit} autoFocus disabled={!gender}>
        <p>Next</p>
      </Button>
    </div>
  );
}
