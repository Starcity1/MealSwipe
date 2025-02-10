import React, {useEffect,useState} from 'react'

import TinderCard from 'react-tinder-card'




function App(){

  const [backendData, setBackendData] = useState(null)
  
  useEffect(() => {
    fetch("http://localhost:5001/api")
      .then(response => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.json();
      })
      .then(data => {
        console.log("Fetched data:", data);  // Debugging log
        setBackendData(data);
      })
      .catch(error => console.error("Fetch error:", error));
  }, []);
  
  return (
    <div>
      {!backendData ? (
        <p>Loading...</p>
      ) : (
        backendData.restaurants?.map((restaurant, i) => (
          <p key={i}>{restaurant}</p>
        ))
      )}
    </div>
  );
  
}

export default App