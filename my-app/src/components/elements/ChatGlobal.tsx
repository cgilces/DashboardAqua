import { useLocation } from "react-router-dom";
import ChatFlotante from "./ChatFlotante";
import JarvisBienvenida from "./JarvisBienvenida";

const ChatGlobal = () => {
  const location = useLocation();

  // ❌ Ocultar en Login
  if (location.pathname === "/") {
    return null;
  }

  return (
    <>
      <JarvisBienvenida />
      <ChatFlotante />
    </>
  );
};

export default ChatGlobal;