const express = require('express');
require('dotenv').config();
const StaticMaps = require('staticmaps');
const AWS = require('aws-sdk');

const app = express();
const s3 = new AWS.S3({
	region:'eu-central-1',
	signatureVersion: 'v4',
	accessKeyId: process.env.ACCESS_KEY_ID,
	secretAccessKey: process.env.SECRET_ACCESS_KEY,
});

const getDimensions = (size) => {
	switch (size) {
		case 'small':
			return {
				width: 600,
				height: 300,
			};
		case 'medium':
			return {
				width: 1000,
				height: 500,
			};
		case 'large':
			return {
				width: 1200,
				height: 600,
			};
		default:
			return {
				width: 800,
				height: 400,
			};
	}
};

const generateMap = async (lat, lng, size, zoom = 16) => {
	const mapImage = `map-${lat}-${lng}-${size}.png`;

	const mapDimensions = getDimensions(size);

	const mapOptions = {
		width: mapDimensions.width,
		height: mapDimensions.height,
		tileUrl: 'https://mt.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
	};

	const mapMarker = {
		img: `${__dirname}/assets/map_pin.png`,
		offsetX: 22,
		offsetY: 16,
		width: 32,
		height: 44,
		coord: [parseFloat(lng),parseFloat(lat)],
		};

	const map = new StaticMaps(mapOptions);
	const center = [parseFloat(lng),parseFloat(lat)];

	map.addMarker(mapMarker);

	return new Promise((resolve, reject) => {
		map.render(center, zoom)
		.then(async () => {

			const imageBuffer = await map.image.buffer('image/png');

			const uploadParams = { Bucket: process.env.BUCKET, Key: '', Body: '', ContentType: 'image/png', };

			uploadParams.Body = imageBuffer;
			uploadParams.Key = mapImage;

			s3.upload(uploadParams, function (err, data) {
				if (err) {
					reject(err);
				}

				if (data) {
					resolve(data.Location);
				}
			});
		})
		.catch((err) => reject(err));
	});
};

app.get('/generate', async (req, res) => {
	const { query } = req;

	const { lat, lng, zoom = 16 } = query;

	try {
		const smallLink = await generateMap(lat, lng, 'small', zoom);
		const mediumLink = await generateMap(lat, lng, 'medium', zoom);
		const largeLink = await generateMap(lat, lng, 'large', zoom);

		res.json({
			status: 'success',
			versions: {
				small: smallLink,
				medium: mediumLink,
				large: largeLink,
			}
		});
	} catch (err) {
		console.log(err);
	}

});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => console.log(`Server started on port ${PORT}`));
