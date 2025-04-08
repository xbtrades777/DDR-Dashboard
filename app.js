const DDRDashboard = () => {
  const [selectedModel, setSelectedModel] = useState('');
  const [datasetCount, setDatasetCount] = useState(0);
  
  const allModels = [
    'Min - Min',
    'Min - MinMed',
    'Min - MedMax',
    'Min - Max+',
    'MinMed - Min',
    'MinMed - MinMed',
    'MinMed - MedMax',
    'MinMed - Max+',
    'MedMax - Min',
    'MedMax - MinMed',
    'MedMax - MedMax',
    'Max+ - Min',
    'Max+ - MedMax',
    ''
  ];
  
  return (
    <div className="p-6 max-w-4xl mx-auto bg-white rounded-lg shadow-lg">
      <h1 className="text-2xl font-bold mb-6 text-gray-800">DDR Probability Dashboard</h1>
      
      <div className="bg-gray-50 p-4 rounded-md mb-4">
        <h2 className="font-semibold mb-2 text-gray-700">START</h2>
        <select 
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-md"
        >
          <option value="">Select a model</option>
          {allModels.map((model) => (
            <option key={model} value={model}>{model}</option>
          ))}
        </select>
      </div>
      
      <div className="mt-6 bg-blue-100 p-4 rounded-lg shadow-sm">
        <h2 className="font-semibold text-gray-800">Simple Test Dashboard</h2>
        <p className="mt-2">Selected model: {selectedModel || 'None'}</p>
        <p className="mt-2">If you can see this, React is working correctly!</p>
      </div>
    </div>
  );
};

// Define React hooks
const { useState, useEffect } = React;

// Render the React component
ReactDOM.render(<DDRDashboard />, document.getElementById('root'));
