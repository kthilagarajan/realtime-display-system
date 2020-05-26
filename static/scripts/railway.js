let token, socket;
$(document).ready(() => {
  let lat, long;
  $(".loader").toggle("show");
  $(".error-gps").toggle("hide");

  function getLocation() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(showPosition, errorPosition);
    } else {
      $(".error-gps").toggle("show");
      $(".loader").toggle("hide");
    }
  }

  function showPosition(position) {
    lat = position.coords.latitude;
    long = position.coords.longitude;
    $(".lat-input").val(lat);
    $(".long-input").val(long);
    $(".loader").toggle("hide");
    getStations();
  }

  function errorPosition(error) {
    if (error.code == error.PERMISSION_DENIED) {
      console.log("Location Permission Denied");
    }
    getStations();
    $(".error-gps").toggle("show");
    $(".loader").toggle("hide");
  }

  async function getStations() {
    let resposne = await fetch("/stations", {
      method: "POST",
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json',
        token
      },
      body: JSON.stringify({ lat, long })
    });
    let result = await resposne.json();
    var template = $("#select-options").html();
    var rendered = Mustache.render(template, { options: result.data });
    if (lat && long) {
      $(".nearby-station-select").html(rendered)
    } else {
      $(".all-station-select").html(rendered)
    }
  }
  

  async function getToken(cbk) {
    let resposne = await fetch("/token", {
      method: "POST",
      headers: {
        'Accept': 'application/json, text/plain, */*',
        'Content-Type': 'application/json'
      }
    });
    let result = await resposne.json();
    token = result.token;
    cbk();
  }

  getToken(() => {
    getLocation();
    socket = io.connect(`${window.location.href}`, {
      query: {token}
    });
  });

  // socket.on('disconnect', function () {

  // });
});
// socket.on('connect', function () {
//   console.log('connect ' + socket.id);
// });
async function findTrains(selector) {
  let stationCode = $(selector).val();
  let resposne = await fetch(`/trains/${stationCode}`, {
    method: "GET",
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
      token
    }
  });
  let result = await resposne.json();
  let trains = result.data;
  if(trains.length > 0) {
    socket.on(stationCode, function (data) {
      $(`.${data.trainNo} .status`).html(data.message)
      // console.log(data)
    });
    var template = $("#train-record-row").html();
    var rendered = Mustache.render(template, { trains });
    $(".train-records").html(rendered)
  } else {
    alert("No trains found! Try with different station!")
  }
}
let interval = null;
async function findTrainUpdates(selector) {
  if (interval) {
    clearInterval(interval)
  }
  getLiveFeeds($(selector).val())
  interval = setInterval(async () => {
    getLiveFeeds($(selector).val())
  }, 15000);
}

async function getLiveFeeds(stationCode) {
  $(".loader").toggle("show");
  let resposne = await fetch(`/${stationCode}/train/status`, {
    method: "POST",
    headers: {
      'Accept': 'application/json, text/plain, */*',
      'Content-Type': 'application/json',
      token
    }
  });
  let result = await resposne.json();
  $(".loader").toggle("hide");
}
