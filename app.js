const DDRDashboard = function() {
  // All available first parts of models only
  var allModels = [
    'Min',
    'MinMed',
    'MedMax',
    'Max+',
    ''  // Blank option
  ];

  // High/Low options
  var highLowOptions = [
    'Low ODR',
    'High ODR',
    'Low Trans',
    'High Trans',
    'Low RDR',
    'High RDR'
  ];

  // Color options
  var colorOptions = [
    'MinMed Green',
    'MedMax Green',
    'Max+ Green',
    'MinMed Red',
    'MedMax Red',
    'Max+ Red'
  ];

  // Percentage options for Min
  var percentageOptions = [
    'Green 0 - 50%',
    'Green 50 - 100%',
    'Red 0 - 50%',
    'Red 50 - 100%'
  ];

  // State for selections using useState
  var selectedModel = useState('')[0];
  var setSelectedModel = useState('')[1];
  var selectedHighLow = useState('')[0];
  var setSelectedHighLow = useState('')[1];
  var selectedColor = useState('')[0];
  var setSelectedColor = useState('')[1];
  var selectedPercentage = useState('')[0];
  var setSelectedPercentage = useState('')[1];
  var showPercentage = useState(false)[0];
  var setShowPercentage = useState(false)[1];
  
  // Dataset count
  var datasetCount = useState(0)[0];
  var setDatasetCount = useState(0)[1];

  // State for Google Sheet data
  var isLoading = useState(false)[0];
  var setIsLoading = useState(false)[1];
  var sheetData = useState([])[0];
  var setSheetData = useState([])[1];
  var error = useState(null)[0];
  var setError = useState(null)[1];
  var probabilityStats = useState(null)[0];
  var setProbabilityStats = useState(null)[1];

  // State for API connection parameters
  var apiKey = useState('AIzaSyBB5_LHGAX_tirA23TzDEesMJhm_Srrs9s')[0];
  var setApiKey = useState('AIzaSyBB5_LHGAX_tirA23TzDEesMJhm_Srrs9s')[1];
  var spreadsheetId = useState('1RLktcJRtgG2Hoszy8Z5Ur9OoVZP_ROxfIpAC6zRGE0Q')[0];
  var setSpreadsheetId = useState('1RLktcJRtgG2Hoszy8Z5Ur9OoVZP_ROxfIpAC6zRGE0Q')[1];
  var sheetName = useState('DDR Modeling Raw')[0];
  var setSheetName = useState('DDR Modeling Raw')[1];
  var sheetRange = useState('DDR Modeling Raw!A1:Z1000')[0];
  var setSheetRange = useState('DDR Modeling Raw!A1:Z1000')[1];

  // Control when to show color selection
  var showColorSelection = useState(false)[0];
  var setShowColorSelection = useState(false)[1];
  
  useEffect(function() {
    if (selectedModel === 'Min') {
      setShowPercentage(true);
      setShowColorSelection(false);
      setSelectedColor('');
    } else if (selectedModel) {
      setShowPercentage(false);
      setShowColorSelection(true);
      setSelectedPercentage('');
    } else {
      setShowPercentage(false);
      setShowColorSelection(false);
      setSelectedPercentage('');
      setSelectedColor('');
    }
  }, [selectedModel]);
  
  // Load data on mount if credentials available
  useEffect(function() {
    if (apiKey && spreadsheetId) {
      fetchGoogleSheetsAPI(apiKey, spreadsheetId, sheetRange);
    }
  }, [apiKey, spreadsheetId, sheetRange]);
  
  // Update dataset count and timing stats when selections change
  useEffect(function() {
    updateDatasetCount();
    if (sheetData.length > 0) {
      var firstHitStats = calculateTimingStats(sheetData, 'first_hit_time');
      var secondHitStats = calculateTimingStats(sheetData, 'second_hit_time');
      setProbabilityStats(function(prev) {
        return {
          totalCount: prev ? prev.totalCount : 0,
          winRate: prev ? prev.winRate : 0,
          lossRate: prev ? prev.lossRate : 0,
          breakEvenRate: prev ? prev.breakEvenRate : 0,
          outcomeCounts: prev ? prev.outcomeCounts : { 'Min': 0, 'MinMed': 0, 'MedMax': 0, 'Max+': 0 },
          outcomePercentages: prev ? prev.outcomePercentages : {},
          averages: prev ? prev.averages : {},
          resultCounts: prev ? prev.resultCounts : {},
          resultPercentages: prev ? prev.resultPercentages : {},
          firstHitStats: firstHitStats,
          secondHitStats: secondHitStats
        };
      });
    }
  }, [selectedModel, selectedHighLow, selectedColor, selectedPercentage, sheetData]);

  // Function to fetch data from Google Sheets API
  var fetchGoogleSheetsAPI = async function(apiKey, spreadsheetId, range) {
    setIsLoading(true);
    setError(null);
    
    try {
      var url = 'https://sheets.googleapis.com/v4/spreadsheets/' + spreadsheetId + '/values/' + range + '?key=' + apiKey;
      console.log('Attempting to fetch from:', url);
      
      var response = await fetch(url);
      var responseText = await response.text();
      
      try {
        var data = JSON.parse(responseText);
        
        if (!response.ok) {
          console.error('API Error Details:', data);
          throw new Error('API error: ' + (data.error && data.error.message ? data.error.message : 'Unknown error'));
        }
        
        if (!data.values || data.values.length === 0) {
          setError('No data found in the specified range');
          setIsLoading(false);
          return;
        }
        
        var headers = data.values[0];
        var rows = data.values.slice(1);
        
        console.log('Headers detected:', headers);
        console.log('Row count:', rows.length);
        
        var processedData = rows.map(function(row) {
          var item = {};
          headers.forEach(function(header, index) {
            var key = header.toLowerCase().replace(/\s+/g, '_');
            item[key] = row[index] || null;
          });
          return item;
        });
        
        console.log('Sample processed data:', processedData.slice(0, 2));
        
        setSheetData(processedData);
        setIsLoading(false);
        updateDatasetCount();
      } catch (jsonError) {
        console.error('Response is not valid JSON:', responseText);
        throw new Error('Invalid API response: ' + responseText.substring(0, 100) + '...');
      }
    } catch (error) {
      console.error('Fetch error:', error);
      setError('Error fetching data: ' + error.message);
      setIsLoading(false);
    }
  };

  // Function to update dataset count based on selected criteria
  var updateDatasetCount = function() {
    if (!selectedModel || sheetData.length === 0) {
      setDatasetCount(0);
      setProbabilityStats(null);
      return;
    }
    
    console.log('Filtering with first hit:', selectedModel);
    console.log('Selected percentage:', selectedPercentage);
    
    if (sheetData.length > 0) {
      console.log('Sample item:', sheetData[0]);
    }
    
    var matchingData = sheetData.filter(function(item) {
      var modelMatch = !selectedModel || (item.model && item.model.indexOf(selectedModel + ' -') === 0);
      var colorMatch = !selectedColor || item.outside_min_start === selectedColor;
      var percentageMatch = !selectedPercentage || (item['color_%'] === selectedPercentage);
      var highLowMatch = !selectedHighLow || item.first_hit_time === selectedHighLow;
      
      return modelMatch && colorMatch && percentageMatch && highLowMatch;
    });
    
    console.log('Found matching datasets:', matchingData.length);
    
    setDatasetCount(matchingData.length);
    
    if (matchingData.length > 0) {
      calculateProbabilities(matchingData);
    } else {
      setProbabilityStats(null);
    }
  };

  // Calculate probability statistics
  var calculateProbabilities = function(filteredData) {
    var totalCount = filteredData.length;
    
    try {
      var outcomeTypes = ['Min', 'MinMed', 'MedMax', 'Max+'];
      var outcomeCounts = { 'Min': 0, 'MinMed': 0, 'MedMax': 0, 'Max+': 0 };
      
      filteredData.forEach(function(item) {
        if (item.model) {
          var parts = item.model.split(' - ');
          if (parts.length === 2) {
            var secondHit = parts[1];
            if (outcomeTypes.indexOf(secondHit) !== -1) {
              outcomeCounts[secondHit]++;
            }
          }
        }
      });
      
      var outcomePercentages = {};
      outcomeTypes.forEach(function(type) {
        outcomePercentages[type] = totalCount > 0 
          ? ((outcomeCounts[type] / totalCount) * 100).toFixed(1) 
          : 0;
      });
      
      var resultField = 'result';
      var resultCounts = {};
      var totalResults = 0;
      
      filteredData.forEach(function(item) {
        if (item[resultField]) {
          resultCounts[item[resultField]] = (resultCounts[item[resultField]] || 0) + 1;
          totalResults++;
        }
      });
      
      var resultPercentages = {};
      for (var result in resultCounts) {
        if (resultCounts.hasOwnProperty(result)) {
          resultPercentages[result] = totalResults > 0 
            ? ((resultCounts[result] / totalResults) * 100).toFixed(1) 
            : 0;
        }
      }
      
      var numericFields = ['rdr_range', 'odr_range', 'profit', 'loss', 'drawdown'];
      var averages = {};
      
      numericFields.forEach(function(field) {
        var validValues = filteredData
          .map(function(item) { return parseFloat(item[field]); })
          .filter(function(val) { return !isNaN(val); });
        if (validValues.length > 0) {
          var sum = validValues.reduce(function(acc, val) { return acc + val; }, 0);
          averages[field] = (sum / validValues.length).toFixed(2);
        } else {
          averages[field] = 'N/A';
        }
      });
      
      var winRate = resultPercentages['win'] || 0;
      var lossRate = resultPercentages['loss'] || 0;
      var breakEvenRate = resultPercentages['break_even'] || 0;
      
      setProbabilityStats({
        totalCount: totalCount,
        winRate: winRate,
        lossRate: lossRate,
        breakEvenRate: breakEvenRate,
        outcomeCounts: outcomeCounts,
        outcomePercentages: outcomePercentages,
        averages: averages,
        resultCounts: resultCounts,
        resultPercentages: resultPercentages
      });
    } catch (error) {
      console.error('Error calculating probabilities:', error);
      setProbabilityStats({
        totalCount: totalCount,
        error: error.message
      });
    }
  };

  // Function to calculate timing statistics
  var calculateTimingStats = function(data, timeField) {
    var times = data
      .map(function(item) {
        var time = item[timeField];
        return time ? new Date('1970-01-01T' + time).getTime() : null;
      })
      .filter(function(time) { return time !== null; })
      .sort(function(a, b) { return a - b; });

    if (times.length === 0) return { median: null, percentile70: null, counts: {} };

    var mid = Math.floor(times.length / 2);
    var median = times.length % 2 ? times[mid] : (times[mid - 1] + times[mid]) / 2;
    var percentile70Index = Math.floor(times.length * 0.7);
    var percentile70 = times[percentile70Index];

    var counts = {};
    times.forEach(function(time) {
      var hour = new Date(time).toTimeString().slice(0, 5); // HH:MM format
      counts[hour] = (counts[hour] || 0) + 1;
    });

    return {
      median: new Date(median).toTimeString().slice(0, 5),
      percentile70: new Date(percentile70).toTimeString().slice(0, 5),
      counts: counts,
    };
  };

  // Handle model selection change
  var handleModelChange = function(event) {
    setSelectedModel(event.target.value);
    setSelectedHighLow('');
    setSelectedColor('');
    setSelectedPercentage('');
    updateDatasetCount();
  };
  
  var handleHighLowChange = function(event) {
    setSelectedHighLow(event.target.value);
    updateDatasetCount();
  };
  
  var handleColorChange = function(event) {
    setSelectedColor(event.target.value);
    updateDatasetCount();
  };
  
  var handlePercentageChange = function(event) {
    setSelectedPercentage(event.target.value);
    updateDatasetCount();
  };

  return React.createElement(
    'div',
    { className: 'p-6 max-w-4xl mx-auto bg-white rounded-lg shadow-lg' },
    React.createElement('h1', { className: 'text-2xl font-bold mb-6 text-gray-800' }, 'DDR Probability Dashboard'),
    
    React.createElement(
      'div',
      { className: 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6' },
      React.createElement(
        'div',
        { className: 'bg-gray-50 p-4 rounded-md' },
        React.createElement('h2', { className: 'font-semibold mb-2 text-gray-700' }, 'First Hit Pattern'),
        React.createElement(
          'select',
          {
            value: selectedModel,
            onChange: handleModelChange,
            className: 'w-full p-2 border border-gray-300 rounded-md'
          },
          React.createElement('option', { value: '' }, 'Select pattern'),
          allModels.map(function(model) {
            return React.createElement('option', { key: model, value: model }, model);
          })
        )
      ),
      
      selectedModel && React.createElement(
        'div',
        { className: 'bg-gray-50 p-4 rounded-md' },
        React.createElement('h2', { className: 'font-semibold mb-2 text-gray-700' }, 'First Hit Time'),
        React.createElement(
          'select',
          {
            value: selectedHighLow,
            onChange: handleHighLowChange,
            className: 'w-full p-2 border border-gray-300 rounded-md'
          },
          React.createElement('option', { value: '' }, 'Select time'),
          highLowOptions.map(function(option) {
            return React.createElement('option', { key: option, value: option }, option);
          })
        )
      ),
      
      showColorSelection && React.createElement(
        'div',
        { className: 'bg-gray-50 p-4 rounded-md' },
        React.createElement('h2', { className: 'font-semibold mb-2 text-gray-700' }, 'Color'),
        React.createElement(
          'select',
          {
            value: selectedColor,
            onChange: handleColorChange,
            className: 'w-full p-2 border border-gray-300 rounded-md'
          },
          React.createElement('option', { value: '' }, 'Select color'),
          colorOptions.map(function(color) {
            return React.createElement('option', { key: color, value: color }, color);
          })
        )
      ),
      
      showPercentage && React.createElement(
        'div',
        { className: 'bg-gray-50 p-4 rounded-md' },
        React.createElement('h2', { className: 'font-semibold mb-2 text-gray-700' }, '% Color'),
        React.createElement(
          'select',
          {
            value: selectedPercentage,
            onChange: handlePercentageChange,
            className: 'w-full p-2 border border-gray-300 rounded-md'
          },
          React.createElement('option', { value: '' }, 'Select percentage'),
          percentageOptions.map(function(percentage) {
            return React.createElement('option', { key: percentage, value: percentage }, percentage);
          })
        )
      )
    ),
    
    isLoading && React.createElement(
      'div',
      { className: 'mt-6 p-4 bg-yellow-50 rounded-md text-center' },
      React.createElement('p', { className: 'text-yellow-600' }, 'Loading data from Google Sheet...')
    ),
    
    error && React.createElement(
      'div',
      { className: 'mt-6 p-4 bg-red-50 rounded-md text-center' },
      React.createElement('p', { className: 'text-red-600' }, 'Error: ' + error)
    ),
    
    React.createElement(
      'div',
      { className: 'mt-6 bg-blue-100 p-4 rounded-lg shadow-sm' },
      React.createElement(
        'div',
        { className: 'flex items-center justify-between' },
        React.createElement('h2', { className: 'font-semibold text-gray-800' }, 'Matching Datasets'),
        React.createElement(
          'div',
          { className: 'flex items-center bg-white px-4 py-2 rounded-full shadow' },
          React.createElement('span', { className: 'text-2xl font-bold text-blue-600 mr-2' }, datasetCount),
          React.createElement('span', { className: 'text-gray-500 text-sm' }, 'records')
        )
      )
    ),

    probabilityStats && probabilityStats.outcomePercentages && React.createElement(
      'div',
      { className: 'mt-6' },
      React.createElement('h2', { className: 'font-semibold mb-4 text-gray-800 text-xl' }, 'Second Hit Probabilities'),
      React.createElement(
        'div',
        { className: 'grid grid-cols-1 md:grid-cols-4 gap-4 mb-6' },
        React.createElement(
          'div',
          { className: 'bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg shadow' },
          React.createElement(
            'div',
            { className: 'flex items-center justify-between' },
            React.createElement(
              'div',
              null,
              React.createElement('h3', { className: 'text-sm font-medium text-purple-800' }, 'Min'),
              React.createElement('p', { className: 'text-3xl font-bold text-purple-600' }, probabilityStats.outcomePercentages['Min'] + '%')
            ),
            React.createElement(
              'div',
              { className: 'h-12 w-12 bg-purple-200 rounded-full flex items-center justify-center' },
              React.createElement('span', { className: 'text-purple-700 text-xl' }, 'M')
            )
          ),
          React.createElement('p', { className: 'text-xs text-purple-700 mt-2' }, probabilityStats.outcomeCounts['Min'] + ' occurrences out of ' + probabilityStats.totalCount + ' trades')
        ),
        React.createElement(
          'div',
          { className: 'bg-gradient-to-br from-indigo-50 to-indigo-100 p-4 rounded-lg shadow' },
          React.createElement(
            'div',
            { className: 'flex items-center justify-between' },
            React.createElement(
              'div',
              null,
              React.createElement('h3', { className: 'text-sm font-medium text-indigo-800' }, 'MinMed'),
              React.createElement('p', { className: 'text-3xl font-bold text-indigo-600' }, probabilityStats.outcomePercentages['MinMed'] + '%')
            ),
            React.createElement(
              'div',
              { className: 'h-12 w-12 bg-indigo-200 rounded-full flex items-center justify-center' },
              React.createElement('span', { className: 'text-indigo-700 text-xl' }, 'MM')
            )
          ),
          React.createElement('p', { className: 'text-xs text-indigo-700 mt-2' }, probabilityStats.outcomeCounts['MinMed'] + ' occurrences out of ' + probabilityStats.totalCount + ' trades')
        ),
        React.createElement(
          'div',
          { className: 'bg-gradient-to-br from-cyan-50 to-cyan-100 p-4 rounded-lg shadow' },
          React.createElement(
            'div',
            { className: 'flex items-center justify-between' },
            React.createElement(
              'div',
              null,
              React.createElement('h3', { className: 'text-sm font-medium text-cyan-800' }, 'MedMax'),
              React.createElement('p', { className: 'text-3xl font-bold text-cyan-600' }, probabilityStats.outcomePercentages['MedMax'] + '%')
            ),
            React.createElement(
              'div',
              { className: 'h-12 w-12 bg-cyan-200 rounded-full flex items-center justify-center' },
              React.createElement('span', { className: 'text-cyan-700 text-xl' }, 'MX')
            )
          ),
          React.createElement('p', { className: 'text-xs text-cyan-700 mt-2' }, probabilityStats.outcomeCounts['MedMax'] + ' occurrences out of ' + probabilityStats.totalCount + ' trades')
        ),
        React.createElement(
          'div',
          { className: 'bg-gradient-to-br from-amber-50 to-amber-100 p-4 rounded-lg shadow' },
          React.createElement(
            'div',
            { className: 'flex items-center justify-between' },
            React.createElement(
              'div',
              null,
              React.createElement('h3', { className: 'text-sm font-medium text-amber-800' }, 'Max+'),
              React.createElement('p', { className: 'text-3xl font-bold text-amber-600' }, probabilityStats.outcomePercentages['Max+'] + '%')
            ),
            React.createElement(
              'div',
              { className: 'h-12 w-12 bg-amber-200 rounded-full flex items-center justify-center' },
              React.createElement('span', { className: 'text-amber-700 text-xl' }, 'M+')
            )
          ),
          React.createElement('p', { className: 'text-xs text-amber-700 mt-2' }, probabilityStats.outcomeCounts['Max+'] + ' occurrences out of ' + probabilityStats.totalCount + ' trades')
        )
      )
    ),
    
    probabilityStats && probabilityStats.resultPercentages && React.createElement(
      'div',
      { className: 'mt-6' },
      React.createElement(
        'div',
        { className: 'bg-white p-4 rounded-lg shadow border border-gray-200' },
        React.createElement('h3', { className: 'font-medium text-gray-700 mb-3' }, 'Results Distribution'),
        React.createElement(
          'div',
          { className: 'space-y-3' },
          Object.keys(probabilityStats.resultPercentages).map(function(result) {
            return React.createElement(
              'div',
              { key: result, className: 'space-y-1' },
              React.createElement(
                'div',
                { className: 'flex justify-between text-sm' },
                React.createElement('span', { className: 'capitalize text-gray-600' }, result.replace(/_/g, ' ')),
                React.createElement('span', { className: 'font-medium' }, probabilityStats.resultPercentages[result] + '%')
              ),
              React.createElement(
                'div',
                { className: 'w-full bg-gray-200 rounded-full h-2.5' },
                React.createElement('div', {
                  className: 'h-2.5 rounded-full ' + (
                    result === 'win' ? 'bg-green-500' : 
                    result === 'loss' ? 'bg-red-500' : 'bg-blue-500'
                  ),
                  style: { width: probabilityStats.resultPercentages[result] + '%' }
                })
              )
            );
          })
        )
      )
    ),
    
    React.createElement(
      'div',
      { className: 'mt-8 p-6 bg-white rounded-lg border border-gray-200 shadow-sm' },
      React.createElement('h2', { className: 'font-semibold mb-6 text-gray-800 text-xl' }, 'Visual Representation'),
      selectedModel && probabilityStats && probabilityStats.outcomePercentages ? (
        React.createElement(
          'div',
          { className: 'h-64' },
          React.createElement(
            'div',
            { className: 'h-full flex items-end space-x-8 justify-center' },
            Object.keys(probabilityStats.outcomePercentages).map(function(outcome) {
              return React.createElement(
                'div',
                { key: outcome, className: 'flex flex-col items-center justify-end h-full' },
                React.createElement('div', {
                  className: 'w-24 ' + (
                    outcome === 'Min' ? 'bg-purple-500' : 
                    outcome === 'MinMed' ? 'bg-indigo-500' : 
                    outcome === 'MedMax' ? 'bg-cyan-500' : 'bg-amber-500'
                  ) + ' rounded-t-lg shadow-inner transition-all duration-500 ease-in-out',
                  style: { height: probabilityStats.outcomePercentages[outcome] + '%' }
                }),
                React.createElement(
                  'div',
                  { className: 'mt-2 text-center' },
                  React.createElement('p', { className: 'font-medium' }, outcome),
                  React.createElement('p', { className: 'text-xl font-bold' }, probabilityStats.outcomePercentages[outcome] + '%')
                )
              );
            })
          )
        )
      ) : sheetData.length > 0 ? (
        React.createElement(
          'div',
          { className: 'h-64 flex items-center justify-center' },
          React.createElement('p', { className: 'text-gray-500' }, 'Select a first hit pattern and time to see probability visualization')
        )
      ) : (
        React.createElement(
          'div',
          { className: 'h-64 flex items-center justify-center' },
          React.createElement('p', { className: 'text-gray-500' }, 'Connect to your Google Sheet to see visualizations')
        )
      )
    ),
    
    selectedModel && React.createElement(
      'div',
      { className: 'mt-8 p-4 bg-blue-50 rounded-md' },
      React.createElement('h2', { className: 'font-semibold mb-2 text-gray-700' }, 'Selected Values:'),
      React.createElement('p', null, 'First Hit Pattern: ', selectedModel || 'None'),
      React.createElement('p', null, 'First Hit Time: ', selectedHighLow || 'None'),
      showColorSelection && React.createElement('p', null, 'Color: ', selectedColor || 'None'),
      showPercentage && React.createElement('p', null, 'Percentage: ', selectedPercentage || 'None')
    ),

    React.createElement(
      'div',
      { className: 'mt-8 p-4 bg-gray-50 rounded-md' },
      React.createElement('h2', { className: 'font-semibold mb-4 text-gray-700' }, '
