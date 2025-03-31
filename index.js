import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';
import cors from 'cors';
dotenv.config();

const app = express();
const PORT = process.env.PORT;

let access_token = '';

app.use(express.json());
app.use(cors());

// 🔄 Get new access token using refresh token
async function refreshAccessToken() {
  const res = await axios.post('https://accounts.zoho.in/oauth/v2/token', null, {
    params: {
      refresh_token: process.env.REFRESH_TOKEN,
      client_id: process.env.CLIENT_ID,
      client_secret: process.env.CLIENT_SECRET,
      grant_type: 'refresh_token',
    },
  });
  access_token = res.data.access_token;
  console.log('🔑 New access token fetched');
}

// 🔁 Middleware to ensure token is ready
app.use(async (req, res, next) => {
  if (!access_token) await refreshAccessToken();
  next();
});

// 📥 Submit review to Zoho Creator
app.post('/submit-review', async (req, res) => {
  const { name, text, rating, designation, company } = req.body;

  try {
    const response = await axios.post(
      process.env.ZOHO_FORM_URL,
      {
        data: {
          Ratings: rating.toString(),
          Name: name,
          Reviews: text,
          Designation: designation,
          Restaurant_Company_Name: company,
        },
      },
      {
        headers: {
          Authorization: `Zoho-oauthtoken ${access_token}`,
          'Content-Type': 'application/json',
        },
      }
    );

    res.json({ success: true, response: response.data });
  } catch (error) {
    if (error.response && error.response.status === 401) {
      await refreshAccessToken();
      return res.redirect(307, '/submit-review'); // retry
    }
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to submit review' });
  }
});

// 📤 Get reviews from Zoho Creator
app.get('/get-reviews', async (req, res) => {
  try {
    const response = await axios.get(process.env.ZOHO_REPORT_URL, {
      headers: {
        Authorization: `Zoho-oauthtoken ${access_token}`,
      },
    });

    const records = response.data.data.map((r) => ({
      name: r.Name,
      text: r.Reviews,
      rating: parseInt(r.Ratings),
      designation: r.Designation,
      company: r.Restaurant_Company_Name,
    }));

    res.json(records);
  } catch (error) {
    if (error.response && error.response.status === 401) {
      await refreshAccessToken();
      return res.redirect(307, '/get-reviews'); // retry
    }
    console.error(error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to fetch reviews' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on http://localhost:${PORT}`);
});
