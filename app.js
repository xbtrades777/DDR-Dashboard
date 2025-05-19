const DDRDashboard = React.createClass({
  getInitialState() {
    return {
      selectedModel: '',
      selectedHighLow: '',
      selectedColor: '',
      selectedPercentage: '',
      showPercentage: false,
      datasetCount: 0,
      isLoading: false,
      sheetData: [],
      error: null,
      probabilityStats: null,
      apiKey: 'AIzaSyBB5_LHGAX_tirA23TzDEesMJhm_Srrs9s',
      spreadsheetId: '1RLktcJRtgG2Hoszy8Z5Ur9OoVZP_ROxfIpAC6zRGE0Q',
      sheetName: 'DDR Modeling Raw',
      sheetRange: 'DDR Modeling Raw!A1:Z1000',
      showColorSelection: false
    };
  },

  componentDidMount() {
    if (this.state.apiKey && this.state.spreadsheetId) {
      this.fetchGoogleSheetsAPI(this.state.apiKey, this.state.spreadsheetId, this.state.sheetRange);
    }
  },

  componentDidUpdate(prevProps, prevState) {
    if (prevState.selectedModel !== this.state.selectedModel) {
      if (this.state.selectedModel === 'Min') {
        this.setState({ showPercentage: true, showColorSelection: false, selectedColor: '' });
      } else if (this.state.selectedModel) {
        this.setState({ showPercentage: false, showColorSelection: true, selectedPercentage: '' });
      } else {
        this.setState({ showPercentage: false, showColorSelection: false, selectedPercentage: '', selectedColor: '' });
      }
    }

    if (
      prevState.selectedModel !== this.state.selectedModel ||
      prevState.selectedHighLow !== this.state.selectedHighLow ||
      prevState.selectedColor !== this.state.selectedColor ||
      prevState.selectedPercentage !== this.state.selectedPercentage ||
      prevState.sheetData !== this.state.sheetData
    ) {
      this.updateDatasetCount();
    }
  },

  fetchGoogleSheetsAPI(apiKey, spreadsheetId, range) {
    this.setState({ isLoading: true, error: null });
    
    const url = `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/${range}?key=${apiKey}`;
    console.log('Attempting to fetch from:', url);
    
    fetch(url)
      .then(response => response.text())
      .then(responseText => {
        try {
          const data = JSON.parse(responseText);
          
          if (!data.values || data.values.length === 0) {
            this.setState({ error: 'No data found in the specified range', isLoading: false });
            return;
          }
          
          const headers = data.values[0];
          const rows = data.values.slice(1);
          
          const processedData = rows.map(row => {
            const item = {};
            headers.forEach((header, index) => {
              const key = header.toLowerCase().replace(/\s+/g, '_');
              item[key] = row[index] || null;
            });
            return item;
          });
          
          this.setState({ sheetData: processedData, isLoading: false }, this.updateDatasetCount);
        } catch (jsonError) {
          console.error('Response is not valid JSON:', responseText);
          this.setState({ error: 'Invalid API response: ' + responseText.substring(0, 100) + '...', isLoading: false });
        }
      })
      .catch(error => {
        console.error('Fetch error:', error);
        this.setState({ error: 'Error fetching data: ' + error.message, isLoading: false });
      });
  },

  updateDatasetCount() {
    if (!this.state.selectedModel || this.state.sheetData.length === 0) {
      this.setState({ datasetCount: 0, probabilityStats: null });
      return;
    }
    
    const matchingData = this.state.sheetData.filter(item => {
      const modelMatch = !this.state.selectedModel || (item.model && item.model.indexOf(this.state.selectedModel + ' -') === 0);
      const colorMatch = !this.state.selectedColor || item.outside_min_start === this.state.selectedColor;
      const percentageMatch = !this.state.selectedPercentage || (item['color_%'] === this.state.selectedPercentage);
      const highLowMatch = !this.state.selectedHighLow || item.first_hit_time === this.state.selectedHighLow;
      
      return modelMatch && colorMatch && percentageMatch && highLowMatch;
    });
    
    this.setState({ datasetCount: matchingData.length });
    
    if (matchingData.length > 0) {
      this.calculateProbabilities(matchingData);
    } else {
      this.setState({ probabilityStats: null });
    }
  },

  parseTime(timeStr) {
    if (!timeStr) return 0;
    const [hours, minutes] = timeStr.split(':').map(Number);
    return hours * 60 + minutes; // Minutes past midnight
  },

  calculateDuration(startTime, endTime) {
    const startMinutes = this.parseTime(startTime);
    let endMinutes = this.parseTime(endTime);

    // Handle wrap-around (if end time is earlier than start time, assume next day)
    if (endMinutes < startMinutes) {
      endMinutes += 24 * 60; // Add 24 hours in minutes
    }

    return endMinutes - startMinutes; // Duration in minutes
  },

  calculateProbabilities(filteredData) {
    const totalCount = filteredData.length;
    const outcomeTypes = ['ODR', 'Trans', 'RDR'];
    const outcomeCounts = { 'ODR': 0, 'Trans': 0, 'RDR': 0 };

    filteredData.forEach(item => {
      if (item.second_hit_time) {
        const secondHit = item.second_hit_time.split(' ')[0]; // Extract "ODR", "Trans", or "RDR"
        if (outcomeTypes.indexOf(secondHit) !== -1) {
          outcomeCounts[secondHit]++;
        }
      }
    });

    const outcomePercentages = {};
    outcomeTypes.forEach(type => {
      outcomePercentages[type] = totalCount > 0 
        ? ((outcomeCounts[type] / totalCount) * 100).toFixed(1) 
        : 0;
    });

    // Calculate durations using Start Time and End Time
    const firstHitDurations = [];
    const secondHitDurations = [];

    filteredData.forEach(item => {
      if (item.start_time && item.end_time) {
        const duration = this.calculateDuration(item.start_time, item.end_time);
        if (item.first_hit_time && item.first_hit_time.trim()) {
          firstHitDurations.push(duration);
        }
        if (item.second_hit_time && item.second_hit_time.trim()) {
          secondHitDurations.push(duration);
        }
      }
    });

    // Bin into 15-minute buckets from 3:00 to 15:55 (780 minutes max)
    const binSize = 15;
    const maxMinutes = 780; // 15:55 - 3:00 = 12 hours 55 minutes
    const firstHitBins = {};
    const secondHitBins = {};

    for (let i = 0; i <= maxMinutes; i += binSize) {
      firstHitBins[i] = 0;
      secondHitBins[i] = 0;
    }

    firstHitDurations.forEach(duration => {
      const bin = Math.floor(duration / binSize) * binSize;
      if (bin <= maxMinutes) firstHitBins[bin] = (firstHitBins[bin] || 0) + 1;
    });

    secondHitDurations.forEach(duration => {
      const bin = Math.floor(duration / binSize) * binSize;
      if (bin <= maxMinutes) secondHitBins[bin] = (secondHitBins[bin] || 0) + 1;
    });

    // Sort durations for median and 70th percentile
    firstHitDurations.sort((a, b) => a - b);
    secondHitDurations.sort((a, b) => a - b);

    const medianFirstHit = firstHitDurations[Math.floor(firstHitDurations.length / 2)] || 0;
    const medianSecondHit = secondHitDurations[Math.floor(secondHitDurations.length / 2)] || 0;
    const percentile70FirstHit = firstHitDurations[Math.floor(firstHitDurations.length * 0.7)] || 0;
    const percentile70SecondHit = secondHitDurations[Math.floor(secondHitDurations.length * 0.7)] || 0;

    this.setState({
      probabilityStats: {
        totalCount,
        outcomeCounts,
        outcomePercentages,
        firstHitDurations,
        secondHitDurations,
        firstHitBins,
        secondHitBins,
        medianFirstHit,
        medianSecondHit,
        percentile70FirstHit,
        percentile70SecondHit
      }
    });
  },

  handleModelChange(event) {
    this.setState({
      selectedModel: event.target.value,
      selectedHighLow: '',
      selectedColor: '',
      selectedPercentage: ''
    }, this.updateDatasetCount);
  },

  handleHighLowChange(event) {
    this.setState({ selectedHighLow: event.target.value }, this.updateDatasetCount);
  },

  handleColorChange(event) {
    this.setState({ selectedColor: event.target.value }, this.updateDatasetCount);
  },

  handlePercentageChange(event) {
    this.setState({ selectedPercentage: event.target.value }, this.updateDatasetCount);
  },

  render() {
    const allModels = ['Min', 'MinMed', 'MedMax', 'Max+', ''];
    const highLowOptions = ['Low ODR', 'High ODR', 'Low Trans', 'High Trans', 'Low RDR', 'High RDR'];
    const colorOptions = ['MinMed Green', 'MedMax Green', 'Max+ Green', 'MinMed Red', 'MedMax Red', 'Max+ Red'];
    const percentageOptions = ['Green 0 - 50%', 'Green 50 - 100%', 'Red 0 - 50%', 'Red 50 - 100%'];

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
              value: this.state.selectedModel,
              onChange: this.handleModelChange,
              className: 'w-full p-2 border border-gray-300 rounded-md'
            },
            React.createElement('option', { value: '' }, 'Select pattern'),
            allModels.map(model => React.createElement('option', { key: model, value: model }, model))
          )
        ),
        this.state.selectedModel && React.createElement(
          'div',
          { className: 'bg-gray-50 p-4 rounded-md' },
          React.createElement('h2', { className: 'font-semibold mb-2 text-gray-700' }, 'First Hit Time'),
          React.createElement(
            'select',
            {
              value: this.state.selectedHighLow,
              onChange: this.handleHighLowChange,
              className: 'w-full p-2 border border-gray-300 rounded-md'
            },
            React.createElement('option', { value: '' }, 'Select time'),
            highLowOptions.map(option => React.createElement('option', { key: option, value: option }, option))
          )
        ),
        this.state.showColorSelection && React.createElement(
          'div',
          { className: 'bg-gray-50 p-4 rounded-md' },
          React.createElement('h2', { className: 'font-semibold mb-2 text-gray-700' }, 'Color'),
          React.createElement(
            'select',
            {
              value: this.state.selectedColor,
              onChange: this.handleColorChange,
              className: 'w-full p-2 border border-gray-300 rounded-md'
            },
            React.createElement('option', { value: '' }, 'Select color'),
            colorOptions.map(color => React.createElement('option', { key: color, value: color }, color))
          )
        ),
        this.state.showPercentage && React.createElement(
          'div',
          { className: 'bg-gray-50 p-4 rounded-md' },
          React.createElement('h2', { className: 'font-semibold mb-2 text-gray-700' }, '% Color'),
          React.createElement(
            'select',
            {
              value: this.state.selectedPercentage,
              onChange: this.handlePercentageChange,
              className: 'w-full p-2 border border-gray-300 rounded-md'
            },
            React.createElement('option', { value: '' }, 'Select percentage'),
            percentageOptions.map(percentage => React.createElement('option', { key: percentage, value: percentage }, percentage))
          )
        )
      ),
      this.state.isLoading && React.createElement(
        'div',
        { className: 'mt-6 p-4 bg-yellow-50 rounded-md text-center' },
        React.createElement('p', { className: 'text-yellow-600' }, 'Loading data from Google Sheet...')
      ),
      this.state.error && React.createElement(
        'div',
        { className: 'mt-6 p-4 bg-red-50 rounded-md text-center' },
        React.createElement('p', { className: 'text-red-600' }, 'Error: ' + this.state.error)
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
            React.createElement('span', { className: 'text-2xl font-bold text-blue-600 mr-2' }, this.state.datasetCount),
            React.createElement('span', { className: 'text-gray-500 text-sm' }, 'records')
          )
        )
      ),
      this.state.probabilityStats && this.state.probabilityStats.outcomePercentages && React.createElement(
        'div',
        { className: 'mt-6' },
        React.createElement('h2', { className: 'font-semibold mb-4 text-gray-800 text-xl' }, 'Second Hit Location Probabilities'),
        React.createElement(
          'div',
          { className: 'grid grid-cols-1 md:grid-cols-3 gap-4 mb-6' },
          React.createElement(
            'div',
            { className: 'bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg shadow' },
            React.createElement(
              'div',
              { className: 'flex items-center justify-between' },
              React.createElement(
                'div',
                null,
                React.createElement('h3', { className: 'text-sm font-medium text-purple-800' }, 'ODR'),
                React.createElement('p', { className: 'text-3xl font-bold text-purple-600' }, this.state.probabilityStats.outcomePercentages['ODR'] + '%')
              ),
              React.createElement(
                'div',
                { className: 'h-12 w-12 bg-purple-200 rounded-full flex items-center justify-center' },
                React.createElement('span', { className: 'text-purple-700 text-xl' }, 'O')
              )
            ),
            React.createElement('p', { className: 'text-xs text-purple-700 mt-2' }, this.state.probabilityStats.outcomeCounts['ODR'] + ' occurrences out of ' + this.state.probabilityStats.totalCount + ' trades')
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
                React.createElement('h3', { className: 'text-sm font-medium text-indigo-800' }, 'Trans'),
                React.createElement('p', { className: 'text-3xl font-bold text-indigo-600' }, this.state.probabilityStats.outcomePercentages['Trans'] + '%')
              ),
              React.createElement(
                'div',
                { className: 'h-12 w-12 bg-indigo-200 rounded-full flex items-center justify-center' },
                React.createElement('span', { className: 'text-indigo-700 text-xl' }, 'T')
              )
            ),
            React.createElement('p', { className: 'text-xs text-indigo-700 mt-2' }, this.state.probabilityStats.outcomeCounts['Trans'] + ' occurrences out of ' + this.state.probabilityStats.totalCount + ' trades')
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
                React.createElement('h3', { className: 'text-sm font-medium text-cyan-800' }, 'RDR'),
                React.createElement('p', { className: 'text-3xl font-bold text-cyan-600' }, this.state.probabilityStats.outcomePercentages['RDR'] + '%')
              ),
              React.createElement(
                'div',
                { className: 'h-12 w-12 bg-cyan-200 rounded-full flex items-center justify-center' },
                React.createElement('span', { className: 'text-cyan-700 text-xl' }, 'R')
              )
            ),
            React.createElement('p', { className: 'text-xs text-cyan-700 mt-2' }, this.state.probabilityStats.outcomeCounts['RDR'] + ' occurrences out of ' + this.state.probabilityStats.totalCount + ' trades')
          )
        )
      ),
      this.state.probabilityStats && this.state.probabilityStats.firstHitBins && this.state.probabilityStats.secondHitBins && React.createElement(
        'div',
        { className: 'mt-6' },
        React.createElement('h2', { className: 'font-semibold mb-4 text-gray-800 text-xl' }, 'Hit Time Distribution'),
        React.createElement(
          'div',
          null,
          React.createElement(
            'svg',
            { width: '800', height: '300', className: 'border border-gray-300 rounded' },
            Object.keys(this.state.probabilityStats.firstHitBins).map((bin, index) => {
              const x = index * 10; // Smaller step for 15-min buckets across 800px
              const firstHitHeight = (this.state.probabilityStats.firstHitBins[bin] / this.state.probabilityStats.totalCount) * 150 * 2; // Amplify height
              const secondHitHeight = (this.state.probabilityStats.secondHitBins[bin] / this.state.probabilityStats.totalCount) * 150 * 2;
              const totalHeight = firstHitHeight + secondHitHeight;
              return [
                React.createElement('rect', {
                  key: `first-${bin}`,
                  x: x,
                  y: 150 - totalHeight,
                  width: 8,
                  height: firstHitHeight,
                  fill: '#3498DB'
                }),
                React.createElement('rect', {
                  key: `second-${bin}`,
                  x: x,
                  y: 150 - totalHeight + firstHitHeight,
                  width: 8,
                  height: secondHitHeight,
                  fill: '#E74C3C'
                })
              ];
            }),
            this.state.probabilityStats.medianFirstHit !== 0 && React.createElement('line', {
              x1: Math.floor(this.state.probabilityStats.medianFirstHit / 15) * 10 + 4,
              y1: 0,
              x2: Math.floor(this.state.probabilityStats.medianFirstHit / 15) * 10 + 4,
              y2: 150,
              stroke: 'white',
              strokeWidth: 2
            }),
            this.state.probabilityStats.percentile70FirstHit !== 0 && React.createElement('line', {
              x1: Math.floor(this.state.probabilityStats.percentile70FirstHit / 15) * 10 + 4,
              y1: 0,
              x2: Math.floor(this.state.probabilityStats.percentile70FirstHit / 15) * 10 + 4,
              y2: 150,
              stroke: 'blue',
              strokeWidth: 2
            }),
            Object.keys(this.state.probabilityStats.firstHitBins).map((bin, index) => {
              return React.createElement('text', {
                key: `label-${bin}`,
                x: index * 10 + 4,
                y: 280,
                textAnchor: 'middle',
                fontSize: '10',
                fill: 'black'
              }, bin);
            }),
            React.createElement('text', {
              x: 400,
              y: 290,
              textAnchor: 'middle',
              fontSize: '12',
              fill: 'black'
            }, 'Distribution (minutes)')
          ),
          React.createElement('p', { className: 'mt-2 text-gray-600' }, `Median: ${this.state.probabilityStats.medianFirstHit.toFixed(2)} minutes`),
          React.createElement('p', { className: 'text-gray-600' }, `70th Percentile: ${this.state.probabilityStats.percentile70FirstHit.toFixed(2)} minutes`)
        )
      ),
      React.createElement(
        'div',
        { className: 'mt-8 p-4 bg-gray-50 rounded-md' },
        React.createElement('h2', { className: 'font-semibold mb-4 text-gray-700' }, 'Google Sheets API Connection'),
        React.createElement(
          'div',
          { className: 'grid grid-cols-1 md:grid-cols-2 gap-4 mb-4' },
          React.createElement(
            'div',
            null,
            React.createElement('label', { htmlFor: 'api-key', className: 'block text-sm font-medium text-gray-700 mb-1' }, 'API Key'),
            React.createElement('input', {
              id: 'api-key',
              type: 'text',
              placeholder: 'Enter your Google API Key',
              className: 'w-full p-2 border border-gray-300 rounded-md',
              value: this.state.apiKey,
              onChange: e => this.setState({ apiKey: e.target.value })
            })
          ),
          React.createElement(
            'div',
            null,
            React.createElement('label', { htmlFor: 'spreadsheet-id', className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Spreadsheet ID'),
            React.createElement('input', {
              id: 'spreadsheet-id',
              type: 'text',
              placeholder: 'Enter your Spreadsheet ID',
              className: 'w-full p-2 border border-gray-300 rounded-md',
              value: this.state.spreadsheetId,
              onChange: e => this.setState({ spreadsheetId: e.target.value })
            })
          )
        ),
        React.createElement(
          'div',
          { className: 'mb-4' },
          React.createElement('label', { htmlFor: 'sheet-name', className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Sheet Name'),
          React.createElement('input', {
            id: 'sheet-name',
            type: 'text',
            placeholder: 'e.g., DDR Modeling Raw',
            className: 'w-full p-2 border border-gray-300 rounded-md',
            value: this.state.sheetName,
            onChange: e => this.setState({ sheetName: e.target.value, sheetRange: e.target.value + '!A1:Z1000' })
          })
        ),
        React.createElement(
          'div',
          { className: 'mb-4' },
          React.createElement('label', { htmlFor: 'sheet-range', className: 'block text-sm font-medium text-gray-700 mb-1' }, 'Sheet Range (optional)'),
          React.createElement('input', {
            id: 'sheet-range',
            type: 'text',
            placeholder: 'e.g., DDR Modeling Raw!A1:Z1000',
            className: 'w-full p-2 border border-gray-300 rounded-md',
            value: this.state.sheetRange,
            onChange: e => this.setState({ sheetRange: e.target.value })
          })
        ),
        React.createElement(
          'div',
          { className: 'flex justify-end' },
          React.createElement(
            'button',
            {
              className: 'bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-md',
              onClick: () => this.fetchGoogleSheetsAPI(this.state.apiKey, this.state.spreadsheetId, this.state.sheetRange),
              disabled: !this.state.apiKey || !this.state.spreadsheetId
            },
            'Connect'
          )
        )
      )
    );
  }
});

ReactDOM.render(React.createElement(DDRDashboard), document.getElementById('root'));
