import { useState, useEffect } from "react";

function App() {
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchMessage = async () => {
      try {
        const res = await fetch("http://localhost:5000/api/message"); 
        const data = await res.json();
        setMessage(data.message);
      } catch (err) {
        console.error("Error:", err);
      }
    };

    fetchMessage();
  }, []);

  return (
    <div>
      <h1>React + Express</h1>
      <p>{message}</p>
    </div>
  );
}

export default App;
