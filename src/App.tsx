import React, { useEffect } from "react";
import logo from "./logo.svg";
import "./App.css";
import { DiscoveryManager } from "./chat/DiscoveryManager";

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
      <header className="App-header">
        <img src={logo} className="App-logo" alt="logo" />
        <p>
          Edit <code>src/App.tsx</code> and save to reload.
        </p>
        <a
          className="App-link"
          href="https://reactjs.org"
          target="_blank"
          rel="noopener noreferrer"
        >
          Learn React
        </a>
      </header>
    </div>
  );
}

export default App;
