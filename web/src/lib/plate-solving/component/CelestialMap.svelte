<script lang="ts">
  import { browser } from '$app/environment';
  import { onMount } from 'svelte';

  import d3CelestialConfig from '../config/d3-celestial-config.ts';

  onMount(async () => {
    if (browser) {
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