import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/")({
  component: Index,
});

type Cell = "X" | "O" | null;

function calculateWinner(squares: Cell[]): Cell {
  const lines = [
    [0, 1, 2], [3, 4, 5], [6, 7, 8],
    [0, 3, 6], [1, 4, 7], [2, 5, 8],
    [0, 4, 8], [2, 4, 6],
  ];
  for (const [a, b, c] of lines) {
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return squares[a];
    }
  }
  return null;
}

function Index() {
  const [squares, setSquares] = useState<Cell[]>(Array(9).fill(null));
  const [xIsNext, setXIsNext] = useState(true);

  const winner = calculateWinner(squares);
  const isDraw = !winner && squares.every(Boolean);
  const status = winner
    ? `Vencedor: ${winner}`
    : isDraw
      ? "Empate!"
      : `Próximo: ${xIsNext ? "X" : "O"}`;

  const handleClick = (i: number) => {
    if (squares[i] || winner) return;
    const next = squares.slice();
    next[i] = xIsNext ? "X" : "O";
    setSquares(next);
    setXIsNext(!xIsNext);
  };

  const reset = () => {
    setSquares(Array(9).fill(null));
    setXIsNext(true);
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background p-6">
      <h1 className="text-4xl font-bold tracking-tight text-foreground">Jogo da Velha</h1>
      <p className="text-lg text-muted-foreground">{status}</p>

      <div className="flex gap-2">
        <button
          onClick={() => setXIsNext(true)}
          className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
            xIsNext
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-card-foreground hover:bg-accent"
          }`}
        >
          Jogar (X)
        </button>
        <button
          onClick={() => setXIsNext(false)}
          className={`rounded-md border px-4 py-2 text-sm font-medium transition-colors ${
            !xIsNext
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-card text-card-foreground hover:bg-accent"
          }`}
        >
          Jogar (O)
        </button>
      </div>

      <div className="grid grid-cols-3 gap-2">
        {squares.map((value, i) => (
          <button
            key={i}
            onClick={() => handleClick(i)}
            className="flex h-24 w-24 items-center justify-center rounded-lg border border-border bg-card text-4xl font-bold text-card-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed"
            disabled={!!value || !!winner}
            aria-label={`Casa ${i + 1}`}
          >
            {value}
          </button>
        ))}
      </div>

      <button
        onClick={reset}
        className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
      >
        Reiniciar
      </button>
    </main>
  );
}
