'use strict';

//Dependencies
const express = require('express');

const superagent = require('superagent');

const cors = require('cors');

const pg = require('pg')

//configure environment variables
require('dotenv').config();

//Connection to database
const client = new pg.Client(process.env.DATABASE_URL);
client.connect();
client.on('err', err => console.error(err));

const app = express();

const PORT = process.env.PORT;

app.use(cors());



//url get functions
app.get('/weather', getWeather);

app.get('/movies', getMovie);

app.get('/yelp', getYelp);

app.get('/trails', getTrails);

app.get('/meetups', getMeetups);

app.get('/location', getLocation);

app.listen(PORT, () => console.log(`Listening on ${PORT}`));



//---------------LOCATION--------------------


function getLocation(request, response) {
  const locationHandler = {

    query: request.query.data,
    cacheHit: (results) => {
      console.log('Got Data from SQL');
      response.send(results.rows[0]);
    },
    cacheMiss: () => {
      Location.fetchLocation(request.query.data)
        .then(data => response.send(data));
      Weather.fetchWeather();
    },
  };

  Location.lookupLocation(locationHandler);

}

Location.fetchLocation = (query) => {
  const geoData = `https://maps.googleapis.com/maps/api/geocode/json?address=${query}&key=${process.env.GEOCODE_API_KEY}`;
  return superagent.get(geoData)
    .then(response => {
      if(!response.body.results.length){
        throw 'No Data';
      }else{
        let location = new Location(query, response.body.results[0]);

        return location.save()
          .then(result => {
            location.id = result.rows[0].id;
            return location;
          })
      }
    })
    .catch(error => handleError(error));
};



//constructor for location information
function Location(query, response){
  this.formatted_query = response.formatted_address;
  this.latitude = response.geometry.location.lat;
  this.longitude = response.geometry.location.lng;
  this.search_query = query;
}

Location.prototype.save = function(){
  let SQL = `INSERT INTO locations (search_query, formatted_query, latitude, longitude) VALUES ($1, $2, $3, $4) RETURNING id;`;
  let values = [this.search_query, this.formatted_query, this.latitude,this.longitude];
  return client.query(SQL, values);
}

Location.lookupLocation = (handler) => {
  const SQL = `SELECT * FROM locations WHERE search_query=$1`;
  const values = [handler.query];

  return client.query( SQL, values )
    .then( results => {
      if (results.rowCount > 0) {
        handler.cacheHit(results);
      }
      else{
        handler.cacheMiss();
      }
    })
    .catch( console.error );
};





//----------------------Weather----------------------


//searches for weather of the location using the long and lat from google
Weather.fetchWeather = function(query){

  const newWeatherData = `https://api.darksky.net/forecast/${process.env.WEATHER_API_KEY}/${query.latitude},${query.longitude}`;

  return superagent.get(newWeatherData)
    .then(result => {
      let weatherDataArr = [];
      for(let i =0 ; i< 8; i++){
        let weatherData = new Weather(result.body.daily.data[i]);
        weatherData.save(query.id);
        weatherDataArr.push(weatherData);
      }
      return weatherDataArr
    })
    .catch(error => handleError(error));
}

//constructor for weather data
function Weather(data) {
  this.forecast = data.summary;
  this.time = new Date(data.time * 1000).toString().slice(0, 15);
}

Weather.prototype = {
  save: function(id){
    let SQL = `INSERT INTO weathers (forecast,time,location_id) VALUES ($1,$2,$3);`;
    let values = [this.forecast, this.time, id]
    client.query(SQL, values);
  }
}

//Route Handler
function getWeather(request, response){
  const handler = {
    location:request.query.data,

    cacheHit: (result) =>{
      console.log('Got data from SQL');
      response.send(result.rows);
    },
    cacheMiss: function(){
      Weather.fetchWeather(request.query.data)
        .then(results =>response.send(results))
        .catch(console.error());
    }
  }
  Weather.lookupWeather(handler);
}

Weather.lookupWeather =function (handler){
  const SQL = `SELECT * FROM weathers WHERE location_id=$1`;
  client.query(SQL, [handler.location.id])
    .then(result =>{
      if(result.rowCount>0){
        console.log('Got weather data from SQL');
        handler.cacheHit(result);
      }
      else{
        console.log('Got data from API');
        handler.cacheMiss();
      }
    })
    .catch(error => handleError(error));
};

//-----------------MOVIES----------------------------------------
function fetchMovie(query){
  const movieData = `https://api.themoviedb.org/3/search/movie?api_key=${process.env.MOVIE_API_KEY}&query=${query.search_query}`;
  return superagent.get(movieData)
    .then(movieResults => {
      const movieList = movieResults.body.results.map(movie =>{
        let movieInfo = new MovieData(movie);
        movieInfo.save(query.id);
        return movieInfo;
      });
      return movieList;
    })
    .catch(error => handleError(error));
}

function MovieData(movie){
  this.title = movie.title;
  this.released_on = movie.release_date;
  this.total_votes = movie.vote_count;
  this.average_votes = movie.vote_average;
  this.popularity = movie.popularity;
  this.image_url = 'https://image.tmdb.org/t/p/w500/' + movie.poster_path;
  this.overview = movie.overview;

}
MovieData.prototype = {
  save: function(id){
    let SQL = `INSERT INTO movies (title, released_on, total_votes, average_votes, popularity, image_url, overview, location_id) VALUES ($1, $2, $3, $4, $5, $6, $7, $8);`;
    let values = [this.title, this.released_on, this.total_votes, this.average_votes, this. popularity, this.image_url, this.overview]
    values.push(id);
    client.query(SQL, values);
  }
}

function getMovie(request, response){
  const handler = {
    location: request.query.data,

    cacheHit: (result)=>{
      response.send(result.rows);
    },
    cacheMiss: function(){
      fetchMovie(request.query.data)
        .then (results =>response.send(results))
        .catch(console.error());
    }
  }
  MovieData.lookupMovie(handler);
}

MovieData.lookupMovie = function (handler){
  const SQL = `SELECT * FROM movies WHERE location_id=$1`;
  client.query(SQL, [handler.location.id])
    .then(result =>{
      if(result.rowCount>0){
        handler.cacheHit(result);
      }
      else{
        handler.cacheMiss();
      }
    })
    .catch(error => handleError(error));
}
//-------------------YELP-----------------

function fetchYelp(query){
  const yelpData = `https://api.yelp.com/v3/businesses/search?latitude=${query.latitude}&longitude=${query.longitude}`
  return superagent.get(yelpData)
    .set('Authorization', `Bearer ${process.env.YELP_API_KEY}`)
    .then(result =>{
      const yelpReviews = result.body.businesses.map(yelp =>{
        let yelpItem = new YelpReview(yelp);
        yelpItem.save(query.id);
        return yelpItem;
      })
      return yelpReviews
    })
    .catch(error => handleError(error));
}

function YelpReview(yelp){
  this.url = yelp.url;
  this.name = yelp.name;
  this.rating = yelp.rating;
  this.price = yelp.price;
  this.image_url = yelp.image_url;
}

YelpReview.prototype = {
  save: function(id){
    let SQL =`INSERT INTO yelps (url, name, rating, price,image_url, location_id) VALUES ($1, $2, $3, $4, $5,$6);`;
    let values = [this.url, this.name, this. rating, this.price, this.image_url, id];
    client.query(SQL, values);
  }
};

function getYelp(request, response){
  const handler = {
    location: request.query.data,

    cacheHit: (result)=>{
      response.send(result.rows);
    },

    cacheMiss: function(){
      fetchYelp(request.query.data)
        .then (results => response.send(results))
        .catch(console.error());
    }
  }
  YelpReview.lookupYelp(handler);
}

YelpReview.lookupYelp = function (handler){
  const SQL = `SELECT * FROM yelps WHERE location_id=$1`;
  client.query(SQL, [handler.id])
    .then(result =>{
      if(result.rowCount>0){
        handler.cacheHit(result);
      }
      else{
        handler.cacheMiss();
      }
    })
    .catch(error => handleError(error));
}

//-----------------------TRAILS----------------------


function fetchTrails(query){
  const trailData = `https://www.hikingproject.com/data/get-trails?lat=${query.latitude}&lon=${query.longitude}&maxDistance=10&key=${process.env.TRAILS_API_KEY}`
  return superagent.get(trailData)
    .then(result =>{
      const tData = result.body.trails.map(trails =>{
        console.log(trails);
        let trailsInfo = new Trails(trails);
        trailsInfo.save(query.id);
        return trailsInfo;
      })
      return tData
    })
    .catch(error => handleError(error));
}

Trails.lookupTrails = function(handler){
  const SQL = `SELECT * FROM trails WHERE location_id=$1`;
  client.query(SQL, [handler.id])
    .then(result =>{
      if(result.rowCount>0){
        handler.cacheHit(result);
      }
      else{
        handler.cacheMiss();
      }
    })
    .catch(error => handleError(error));
}


function getTrails(request, response){
  const handler = {
    location: request.query.data,

    cacheHit: (result)=>{
      response.send(result.rows);
    },

    cacheMiss: function(){
      fetchTrails(request.query.data)
        .then (results => response.send(results))
        .catch(console.error());
    },
  }
  Trails.lookupTrails(handler);
}

function Trails(data){
  this.url = data.url;
  this.name = data.name;
  this.location = data.location;
  this.length = data.length;
  this.condition_date = data.conditionDate.split(' ')[0];
  this.condition_time = data.conditionDate.split(' ')[1];
  this.conditions = data.conditionsDetails;
  this.stars = data.stars;
  this.star_votes = data.star_votes;
  this.summary = data.summary;
}

Trails.prototype = {
  save: function(id){
    let SQL = `INSERT INTO trails(url, name,location,length,condition_date,condition_time,conditions,stars,star_votes,summary,location_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11);`;
    let values = [this.url, this.name, this.location, this.length, this.condition_date, this.condition_time, this.conditions, this.stars, this.star_votes, this.summary,id];
    client.query(SQL, values);
  }
}

//----------------------Meetups---------------

function getMeetups(request, response){
  const handler = {
    location: request.query.data,

    cacheHit: (result)=>{
      response.send(result.row);
    },

    cacheMiss: function(){
      fetchMeetups(request.query.data)
        .then (results => response.send(results))
        .catch(console.error());
    },
  }
  Meetup.lookupMeetup(handler);
}

function fetchMeetups(query){
  const meetupData = `https://api.meetup.com/find/groups?&sign=true&photo-host=public&query=${query.search_query}&page=20&key=${process.env.MEETUP_API_KEY}`
  return superagent.get(meetupData)
    .then(result =>{
      const meetupsData = result.body.map(meetup =>{
        let meetupInfo = new Meetup(meetup);
        meetupInfo.save(query.id);
        return meetupInfo;
      })
      return meetupsData
    })
    .catch(error => handleError(error));
}
Meetup.lookupMeetup = function(handler){
  const SQL = `SELECT * FROM meetups WHERE location_id=$1`;
  client.query(SQL, [handler.id])
    .then(result =>{
      if(result.rowCount>0){
        handler.cacheHit(result);
      }
      else{
        handler.cacheMiss();
      }
    })
    .catch(error => handleError(error));
}

function Meetup(data){
  this.link = data.link;
  this.name = data.name;
  this.host = data.organizer.name;
  this.creation_date = data.created;
}

Meetup.prototype = {
  save: function(id){
    let SQL = `INSERT INTO meetups(link,name,host,creation_date, id) VALUES ($1,$2,$3,$4,$5);`;
    let values = [this.link, this.name,this.host, this.creation_date,id];
    client.query(SQL, values);
  }
}


function handleError(err, response){
  console.error(err);
  if(response) response.status(500).send('Something broke, fam.');
}
