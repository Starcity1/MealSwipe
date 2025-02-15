import React, {useEffect,useState} from 'react'



function App(){

  const [backendData, setBackendData] = useState(null)
  
  useEffect(() => {
    fetch("http://localhost:5001/api/serve/get-all-restaurants")
      .then(response => {
        if (!response.ok) {
          throw new Error("Network response was not ok");
        }
        return response.json();
      })
      .then(data => {
        setBackendData(data);
      })
      .catch(error => console.error("Fetch error:", error));
    }, []);
    
  console.log("Fetched data:", backendData);  // Debugging log
  
    return (
    <div>
      {!backendData ? (
        <p>Loading...</p>
      ) : (
        backendData
      )}
    </div>
  );
  
}

export default App