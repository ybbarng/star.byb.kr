<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';

  import d3CelestialConfig from '../config/d3-celestial-config.ts';

  const mergeSexagesimal = (base: number, minutes: number, seconds: number) => {
    const sign = base >= 0 ? 1 : -1;
    return (base * sign + minutes / 60 + seconds / 3600) * sign;
  }

  const raHmsToDec = (hours: number, minutes: number, seconds: number) => {
    const decimal = mergeSexagesimal(hours, minutes, seconds) * 360 / 24;
    if (decimal > 180) {
      return decimal - 360;
    }
    return decimal;
  }

  const decDmsToDec = (degrees: number, minutes: number, seconds: number) => {
    return mergeSexagesimal(degrees, minutes, seconds);
  }

  const longitude = raHmsToDec(4, 51, 6.0);  // ra -180 ~ 180
  const latitude = decDmsToDec(7, 0, 3.7);  // dec -90 ~ 90
  const orientation = 0; // 0 ~ 360

  onMount(async () => {
    if (browser) {
      d3CelestialConfig.center = [longitude, latitude, orientation];
      Celestial.display(d3CelestialConfig);
    }
  });
</script>

<div class="celestial-map">
  <div id="map"></div>
</div>

<style>
  #map {
    width: 100%;
    height: auto;
    margin: 0;
    padding: 0;
    display:
    inline-block;
    position: relative;
  }

  #map canvas {
    display: inline-block;
    position:absolute; z-index:0;
    cursor:hand;
    cursor:grab;
    cursor:-moz-grab;
    cursor:-webkit-grab;
  }

  #map canvas:active {
    cursor:move;
    cursor: grabbing;
    cursor: -moz-grabbing;
    cursor: -webkit-grabbing;
  }
</style>