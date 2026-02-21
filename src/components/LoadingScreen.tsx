import { useEffect, useState } from "react";

export default function LoadingScreen() {
  const [showRetry, setShowRetry] = useState(false);

  useEffect(() => {
    const timer = setTimeout(() => setShowRetry(true), 10000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background gap-4">
      <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground font-extrabold text-xl animate-pulse">
        M
      </div>
      <div className="h-8 w-8 rounded-full border-2 border-primary border-t-transparent animate-spin" />
      {showRetry && (
        <div className="text-center mt-4">
          <p className="text-sm text-muted-foreground mb-3">
            O carregamento está demorando mais que o esperado.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            Recarregar
          </button>
        </div>
      )}
    </div>
  );
}
