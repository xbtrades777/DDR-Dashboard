// Minimal test component
const App = () => {
  return (
    <div style={{padding: "20px", maxWidth: "800px", margin: "0 auto"}}>
      <h1 style={{color: "blue"}}>DDR Dashboard Test</h1>
      <p>If you can see this text, React is working correctly!</p>
      <button 
        style={{
          background: "green", 
          color: "white", 
          padding: "10px 20px", 
          border: "none", 
          borderRadius: "5px",
          cursor: "pointer"
        }}
        onClick={() => alert('Button clicked!')}
      >
        Test Button
      </button>
    </div>
  );
};

// Render the test component
ReactDOM.render(<App />, document.getElementById('root'));
