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
    const outcomeTypes = ['Min', 'MinMed', 'MedMax', 'Max+'];
    const outcomeCounts = { 'Min': 0, 'MinMed': 0, 'MedMax': 0, 'Max+': 0 };

    filteredData.forEach(item => {
      if (item.model) {
        const parts = item.model.split(' - ');
        if (parts.length === 2) {
          const secondHit = parts[1];
          if (outcomeTypes.indexOf(secondHit) !== -1) {
            outcomeCounts[secondHit]++;
          }
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

    // Bin into 15-minute buckets from 3:00 to 15:55 (
