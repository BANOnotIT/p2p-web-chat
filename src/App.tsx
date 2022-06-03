import React, { useEffect } from "react";
import logo from "./logo.svg";
import "./App.css";
import { DiscoveryManager } from "./services/DiscoveryManager";
import { ChatListStoreProvider } from "./components/ChatListStoreProvider";

function App() {
  useEffect(() => {
    const mgr = new DiscoveryManager({ appId: "tester" });
    let infoHash = "";
    let interval = -1;
    let cnt = 0;
    mgr.createAnnounce("test").then((ih) => {
      infoHash = ih;
      mgr.on("peer connected", (data) => {
        console.log(data);
        interval = setInterval(() => {
          data.peer.send(`test ${cnt++} from ${mgr.selfId}`);
        }, 1000) as unknown as number;
        data.peer.on("data", (data: string) => {
          console.log(`I ${mgr.selfId} received: {${data}}`);
        });
      });
    });

    mgr.connectToTrackers();

    return () => {
      clearInterval(interval);
      mgr.destroy();
    };
  }, []);

  return (
    <div className="App">
      <header className="App-header">Test application</header>
      <ChatListStoreProvider>Chat unlocked</ChatListStoreProvider>
    </div>
  );
}

export default App;
