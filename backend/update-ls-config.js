const axios = require('axios');

const LABEL_STUDIO_URL = process.env.LABEL_STUDIO_URL || 'http://label-studio:8080';
const LABEL_STUDIO_API_KEY = process.env.LABEL_STUDIO_API_KEY;

async function updateConfig() {
  // Refresh token
  const tokenRes = await axios.post(
    `${LABEL_STUDIO_URL}/api/token/refresh`,
    { refresh: LABEL_STUDIO_API_KEY },
    { headers: { 'Content-Type': 'application/json' } }
  );
  const token = tokenRes.data.access;
  console.log('Token obtained');

  // New simplified config - removes main textarea, keeps only per-region textarea
  const newConfig = `<View>
  <Header value="Audio Transcription"/>
  <Audio name="audio" value="$audio" hotkey="space"/>
  
  <Labels name="speaker" toName="audio" choice="single">
    <Label value="Speaker 1" background="#FF6B6B"/>
    <Label value="Speaker 2" background="#4ECDC4"/>
    <Label value="Speaker 3" background="#45B7D1"/>
    <Label value="Speaker 4" background="#96CEB4"/>
    <Label value="Unknown" background="#DFE4EA"/>
  </Labels>
  
  <View visibleWhen="region-selected">
    <Header value="Segment Transcription"/>
    <TextArea name="region_transcription" 
              toName="audio" 
              editable="true"
              perRegion="true"
              required="false"
              placeholder="Edit transcription..."/>
  </View>
</View>`;

  console.log('Updating Label Studio project config...');
  
  const updateRes = await axios.patch(
    `${LABEL_STUDIO_URL}/api/projects/1`,
    { label_config: newConfig },
    { headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } }
  );
  
  console.log('Config updated successfully!');
  console.log('New label_config applied.');
}

updateConfig().catch(e => {
  console.error('Error:', e.message);
  if (e.response) {
    console.error('Response:', JSON.stringify(e.response.data, null, 2));
  }
  process.exit(1);
});

