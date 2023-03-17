<script lang="ts">
  import CelestialMap from '$lib/plate-solving/component/CelestialMap.svelte';

  var quadrilateralPoints = [
    [
      [3, 51, 6.0],
      [-3, 0, 3.7]
    ],
    [
      [5, 51, 6.0],
      [-3, 0, 3.7]
    ],
    [
      [5, 51, 6.0],
      [12, 0, 3.7]
    ],
    [
      [3, 51, 6.0],
      [12, 0, 3.7]
    ]
  ];
</script>

<h1>결과</h1>
<div class="container">
  <CelestialMap bind:quadrilateralPoints={quadrilateralPoints} />
</div>
