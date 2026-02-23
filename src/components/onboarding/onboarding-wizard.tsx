"use client";

import { useState, useEffect } from "react";
import { X, Check, Sparkles, Loader2 } from "lucide-react";
import Image from "next/image";

interface Player {
  id: string;
  name: string;
  slug: string;
  position: string;
  imageUrl?: string;
  teamName?: string;
}

interface Team {
  id: string;
  name: string;
  slug: string;
  country: string;
  logoUrl?: string;
  competitionName?: string;
}

interface Competition {
  id: string;
  name: string;
  slug: string;
  type: string;
  logoUrl?: string;
  country?: string;
}

interface OnboardingWizardProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function OnboardingWizard({ onComplete, onSkip }: OnboardingWizardProps) {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const [players, setPlayers] = useState<Player[]>([]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [competitions, setCompetitions] = useState<Competition[]>([]);

  const [selectedPlayers, setSelectedPlayers] = useState<string[]>([]);
  const [selectedTeams, setSelectedTeams] = useState<string[]>([]);
  const [selectedCompetitions, setSelectedCompetitions] = useState<string[]>([]);

  useEffect(() => {
    fetchSuggestions();
  }, []);

  const fetchSuggestions = async () => {
    try {
      const [playersRes, teamsRes, competitionsRes] = await Promise.all([
        fetch("/api/onboarding/suggestions?type=players"),
        fetch("/api/onboarding/suggestions?type=teams"),
        fetch("/api/onboarding/suggestions?type=competitions"),
      ]);

      if (playersRes.ok) setPlayers(await playersRes.json());
      if (teamsRes.ok) setTeams(await teamsRes.json());
      if (competitionsRes.ok) setCompetitions(await competitionsRes.json());
    } catch (error) {
      console.error("Failed to fetch suggestions:", error);
    } finally {
      setLoading(false);
    }
  };

  const togglePlayer = (id: string) => {
    setSelectedPlayers((prev) =>
      prev.includes(id)
        ? prev.filter((p) => p !== id)
        : prev.length < 5
        ? [...prev, id]
        : prev
    );
  };

  const toggleTeam = (id: string) => {
    setSelectedTeams((prev) =>
      prev.includes(id)
        ? prev.filter((t) => t !== id)
        : prev.length < 3
        ? [...prev, id]
        : prev
    );
  };

  const toggleCompetition = (id: string) => {
    setSelectedCompetitions((prev) =>
      prev.includes(id)
        ? prev.filter((c) => c !== id)
        : prev.length < 2
        ? [...prev, id]
        : prev
    );
  };

  const handleNext = () => {
    if (step === 1 && selectedPlayers.length < 2) {
      return; // Could show toast
    }
    if (step === 2 && selectedTeams.length < 1) {
      return;
    }
    setStep((prev) => prev + 1);
  };

  const handleFinish = async () => {
    setSubmitting(true);
    try {
      const res = await fetch("/api/onboarding/complete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          players: selectedPlayers,
          teams: selectedTeams,
          competitions: selectedCompetitions,
        }),
      });

      if (res.ok) {
        onComplete();
      }
    } catch (error) {
      console.error("Failed to complete onboarding:", error);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="bg-white rounded-xl p-8">
          <Loader2 className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
          <p className="mt-4 text-neutral-600">Loading suggestions...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="relative bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-700 p-8 text-white">
          <button
            onClick={onSkip}
            className="absolute top-4 right-4 p-2 hover:bg-white/20 rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-4">
            <Sparkles className="w-8 h-8" />
            <h2 className="text-3xl font-bold">Welcome to SportsDB!</h2>
          </div>

          <p className="text-blue-100 text-lg">
            Let&apos;s personalize your experience in just a few steps
          </p>

          {/* Progress bar */}
          <div className="flex gap-2 mt-6">
            {[1, 2, 3].map((s) => (
              <div
                key={s}
                className={`flex-1 h-2 rounded-full transition-all ${
                  s <= step ? "bg-white" : "bg-white/30"
                }`}
              />
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="p-8 overflow-y-auto max-h-[60vh]">
          {step === 1 && (
            <div>
              <h3 className="text-2xl font-bold text-neutral-900 mb-2">
                Follow Your Favorite Players
              </h3>
              <p className="text-neutral-600 mb-6">
                Select at least 2 players ({selectedPlayers.length}/5 selected)
              </p>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {players.map((player) => {
                  const isSelected = selectedPlayers.includes(player.id);
                  return (
                    <button
                      key={player.id}
                      onClick={() => togglePlayer(player.id)}
                      className={`relative p-4 rounded-xl border-2 transition-all ${
                        isSelected
                          ? "border-blue-600 bg-blue-50"
                          : "border-neutral-200 hover:border-neutral-300 bg-white"
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-2 right-2 w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}

                      <div className="w-16 h-16 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-full mx-auto mb-3 overflow-hidden">
                        {player.imageUrl && (
                          <Image
                            src={player.imageUrl}
                            alt={player.name}
                            width={64}
                            height={64}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>

                      <h4 className="font-semibold text-sm text-neutral-900 mb-1 truncate">
                        {player.name}
                      </h4>
                      <p className="text-xs text-neutral-500 truncate">
                        {player.teamName || "Free Agent"}
                      </p>
                      <p className="text-xs text-neutral-400">
                        {player.position}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <h3 className="text-2xl font-bold text-neutral-900 mb-2">
                Follow Your Favorite Teams
              </h3>
              <p className="text-neutral-600 mb-6">
                Select at least 1 team ({selectedTeams.length}/3 selected)
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {teams.map((team) => {
                  const isSelected = selectedTeams.includes(team.id);
                  return (
                    <button
                      key={team.id}
                      onClick={() => toggleTeam(team.id)}
                      className={`relative p-6 rounded-xl border-2 transition-all flex items-center gap-4 ${
                        isSelected
                          ? "border-green-600 bg-green-50"
                          : "border-neutral-200 hover:border-neutral-300 bg-white"
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-4 right-4 w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}

                      <div className="w-16 h-16 bg-gradient-to-br from-green-600 to-emerald-600 rounded-xl flex-shrink-0 overflow-hidden">
                        {team.logoUrl && (
                          <Image
                            src={team.logoUrl}
                            alt={team.name}
                            width={64}
                            height={64}
                            className="w-full h-full object-contain p-2"
                          />
                        )}
                      </div>

                      <div className="text-left">
                        <h4 className="font-semibold text-lg text-neutral-900 mb-1">
                          {team.name}
                        </h4>
                        <p className="text-sm text-neutral-500">
                          {team.competitionName}
                        </p>
                        <p className="text-xs text-neutral-400">{team.country}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {step === 3 && (
            <div>
              <h3 className="text-2xl font-bold text-neutral-900 mb-2">
                Follow Competitions (Optional)
              </h3>
              <p className="text-neutral-600 mb-6">
                Select competitions to track ({selectedCompetitions.length}/2
                selected)
              </p>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {competitions.map((competition) => {
                  const isSelected = selectedCompetitions.includes(
                    competition.id
                  );
                  return (
                    <button
                      key={competition.id}
                      onClick={() => toggleCompetition(competition.id)}
                      className={`relative p-6 rounded-xl border-2 transition-all ${
                        isSelected
                          ? "border-yellow-600 bg-yellow-50"
                          : "border-neutral-200 hover:border-neutral-300 bg-white"
                      }`}
                    >
                      {isSelected && (
                        <div className="absolute top-4 right-4 w-6 h-6 bg-yellow-600 rounded-full flex items-center justify-center">
                          <Check className="w-4 h-4 text-white" />
                        </div>
                      )}

                      <div className="w-20 h-20 bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl mx-auto mb-4 overflow-hidden">
                        {competition.logoUrl && (
                          <Image
                            src={competition.logoUrl}
                            alt={competition.name}
                            width={80}
                            height={80}
                            className="w-full h-full object-contain p-2"
                          />
                        )}
                      </div>

                      <h4 className="font-semibold text-lg text-neutral-900 mb-1">
                        {competition.name}
                      </h4>
                      <p className="text-sm text-neutral-500">
                        {competition.type}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="p-6 bg-neutral-50 border-t flex justify-between items-center">
          <button
            onClick={onSkip}
            className="px-6 py-2 text-neutral-600 hover:text-neutral-900 transition-colors"
          >
            Skip for now
          </button>

          <div className="flex gap-3">
            {step > 1 && (
              <button
                onClick={() => setStep((prev) => prev - 1)}
                className="px-6 py-2 border border-neutral-300 rounded-lg text-neutral-700 hover:bg-neutral-100 transition-colors"
              >
                Back
              </button>
            )}

            {step < 3 ? (
              <button
                onClick={handleNext}
                disabled={
                  (step === 1 && selectedPlayers.length < 2) ||
                  (step === 2 && selectedTeams.length < 1)
                }
                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleFinish}
                disabled={submitting}
                className="px-6 py-2 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
              >
                {submitting ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  "Start Exploring"
                )}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
