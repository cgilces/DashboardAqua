import { useLocation } from "react-router-dom";
import ChatFlotante from "./ChatFlotante";

const ChatGlobal = () => {
  const location = useLocation();

  // ❌ Ocultar en Login
  if (location.pathname === "/") {
    return null;
  }

  return <ChatFlotante />;
};

export default ChatGlobal;