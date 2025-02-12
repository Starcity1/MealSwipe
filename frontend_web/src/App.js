import React, {useEffect,useState} from 'react'

import TinderCard from 'react-tinder-card'




function App(){

  const [backendData, setBackendData] = useState(null)

  const onSwipe = (direction) => {
    console.log('You swiped: ' + direction)
  }
  
  const onCardLeftScreen = (myIdentifier) => {
    console.log(myIdentifier + ' left the screen')
  }
  
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
    <div >
      <div className='card-container'>
      <TinderCard onSwipe={onSwipe} onCardLeftScreen={() => onCardLeftScreen('fooBar')} preventSwipe={['right', 'left']}>Hello, World!</TinderCard>

      </div>
    </div>
  );
  
}

export default App