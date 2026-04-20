import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { open } from "@tauri-apps/plugin-dialog";
import "./App.css";

interface Email {
  subject: string;
  sender: string;
  date: string;
  path: string;
}

function App() {
  const [emails, setEmails] = useState<Email[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [status, setStatus] = useState("Ready");
  const [folderPath, setFolderPath] = useState<string | null>(null);

  // Magic: Load saved data on startup
  useEffect(() => {
    const init = async () => {
      const saved = await invoke<string | null>("get_registered_path");
      if (saved) {
        setFolderPath(saved);
        const data = await invoke<Email[]>("search_emails", { query: "" });
        setEmails(data);
      }
    };
    init();
  }, []);

  const handleRegisterFolder = async () => {
    const selected = await open({ directory: true, multiple: false });
    if (selected && typeof selected === "string") {
      setStatus("Indexing OneDrive...");
      try {
        await invoke("index_folder", { folderPath: selected });
        setFolderPath(selected);
        const data = await invoke<Email[]>("search_emails", { query: "" });
        setEmails(data);
        setStatus("Folder Registered & Synced");
      } catch (e) {
        setStatus(`Error: ${e}`);
      }
    }
  };

  const handleRefresh = async () => {
    if (!folderPath) return;
    setStatus("Refreshing...");
    try {
      await invoke("index_folder", { folderPath });
      const data = await invoke<Email[]>("search_emails", { query: searchQuery });
      setEmails(data);
      setStatus("Refresh Complete");
    } catch (e) {
      setStatus(`Error: ${e}`);
    }
  };

  const handleSearch = async (val: string) => {
    setSearchQuery(val);
    const results = await invoke<Email[]>("search_emails", { query: val });
    setEmails(results);
  };

  const handleOpen = async (path: string) => {
    await invoke("open_eml", { path });
  };

  return (
    <div className="container">
      <aside>
        {folderPath && (
          <div className="current-archive">
            <div className="archive-label">CURRENT ARCHIVE</div>
            <div className="archive-path" title={folderPath}>
              {folderPath}
            </div>
          </div>
        )}
        <div className="nav-item" onClick={handleRegisterFolder}>📁 {folderPath ? "Change Archive" : "Open Archive"}</div>
        {folderPath && (
          <div className="nav-item" onClick={handleRefresh}>
            🔄 Refresh
          </div>
        )}
        <div className="status-text">
          {status}
        </div>
        <div className="nav-item version-text">v0.1.0-classic</div>
      </aside>

      <main>
        <div className="search-container">
          <input
            type="text"
            placeholder="Search Current Mailbox (Ctrl+E)"
            value={searchQuery}
            onChange={(e) => handleSearch(e.target.value)}
          />
        </div>

        <div className="table-wrapper">
          <table className="email-table">
            <thead>
              <tr>
                <th style={{ width: '25%' }}>From</th>
                <th style={{ width: '55%' }}>Subject</th>
                <th style={{ width: '20%', textAlign: 'right' }}>Received</th>
              </tr>
            </thead>
            <tbody>
              {emails.map((email, i) => (
                <tr key={i} onDoubleClick={() => handleOpen(email.path)}>
                  <td className="sender-col">{email.sender.split('<')[0]}</td>
                  <td className="subject-col">{email.subject}</td>
                  <td className="date-col">{email.date}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </main>
    </div>
  );
}

export default App;