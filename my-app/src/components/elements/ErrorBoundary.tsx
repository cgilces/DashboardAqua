// components/elements/ErrorBoundary.tsx
// Captura errores de renderizado de React (que no pasan por fetch) y los reporta
// al modal global, además de mostrar una pantalla de recuperación mínima.
import React from "react";
import { notificarErrorGlobal } from "../../utils/errorGlobal";

interface Props { children: React.ReactNode; }
interface State { fallo: boolean; }

class ErrorBoundary extends React.Component<Props, State> {
  state: State = { fallo: false };

  static getDerivedStateFromError(): State {
    return { fallo: true };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    notificarErrorGlobal({
      titulo: "Se produjo un error en la pantalla",
      mensaje:
        "Ocurrió un error al mostrar esta sección. Puedes recargar la página para continuar; si persiste, avisa al administrador.",
      detalle: `${error.message}${info?.componentStack ? "\n" + info.componentStack.split("\n").slice(0, 3).join("\n") : ""}`,
    });
  }

  render() {
    if (this.state.fallo) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-[#06140f] px-4 text-center">
          <div className="max-w-sm">
            <h2 className="text-[#D2B858] text-lg font-bold mb-2">Algo salió mal</h2>
            <p className="text-gray-300 text-sm mb-5">
              Ocurrió un error al cargar esta sección. Recarga la página para continuar.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-lg bg-gradient-to-br from-[#D2B858] to-[#9a7c28] text-black text-sm font-semibold hover:scale-105 active:scale-95 transition-transform"
            >
              Recargar
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default ErrorBoundary;
