import React from "react";
import { ChatListStoreProvider } from "./components/ChatListStoreProvider";
import { ChatLayout } from "./components/ChatLayout";

function App() {
  return (
    <div className="App">
      <header className="App-header">Test application</header>
      <ChatListStoreProvider>
        <ChatLayout />
      </ChatListStoreProvider>
    </div>
  );
}

export default App;
