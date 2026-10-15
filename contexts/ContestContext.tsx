"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Contest } from "@/types";
import {
  DEFAULT_CONTEST,
  getActiveContestId,
  getContests,
  setActiveContestId,
} from "@/services/firestore";

type ContestContextType = {
  contests: Contest[];
  activeContestId: string;
  activeContest: Contest | null;
  loading: boolean;
  error: string | null;
  refreshContests: () => Promise<void>;
  selectContest: (contestId: string) => Promise<void>;
};

const ContestContext = createContext<ContestContextType>({
  contests: [],
  activeContestId: DEFAULT_CONTEST,
  activeContest: null,
  loading: true,
  error: null,
  refreshContests: async () => {},
  selectContest: async () => {},
});

export function ContestProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [contests, setContests] = useState<Contest[]>([]);
  const [activeContestId, setActiveContestState] = useState(DEFAULT_CONTEST);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refreshContests() {
    if (!user) {
      setContests([]);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [rows, current] = await Promise.all([
        getContests(),
        getActiveContestId(user.uid),
      ]);
      setContests(rows);
      setActiveContestState(current || DEFAULT_CONTEST);
      setError(null);
    } catch (err) {
      const code = typeof err === "object" && err !== null && "code" in err
        ? String((err as { code?: string }).code || "")
        : "";
      setError(code === "resource-exhausted" || code === "firestore/resource-exhausted"
        ? "Cota de leituras do Firebase atingida. Seus dados não foram necessariamente apagados."
        : "Falha ao consultar concursos no Firebase. Confira a conexão e as permissões.");
      // Preserve a última lista conhecida; falha de leitura não é lista vazia.
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refreshContests();
  }, [user]);

  async function selectContest(contestId: string) {
    if (!user) return;
    await setActiveContestId(user.uid, contestId);
    setActiveContestState(contestId);
  }

  const activeContest = contests.find(c => c.id === activeContestId) || null;

  return (
    <ContestContext.Provider
      value={{ contests, activeContestId, activeContest, loading, error, refreshContests, selectContest }}
    >
      {children}
    </ContestContext.Provider>
  );
}

export function useContest() {
  return useContext(ContestContext);
}
