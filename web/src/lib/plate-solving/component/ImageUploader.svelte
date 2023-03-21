<script lang="ts">
  var inputUploadImage: HTMLInputElement;
  var files: FileList;
  export var imageDataUrl: string;
  const toDataUrl = (blob: File) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onload = (event) => {
      if (!event.target || !event.target.result) {
        return;
      }
      if (typeof event.target.result != 'string') {
        console.error("The resulf of reading as data url is not string.");
        return;
      }
      imageDataUrl = event.target.result;
    };
  };
</script>

<div class="image-uploader">
  <input
    class="hidden"
    id="input-upload-image"
    type="file"
    accept=".png,.jpg"
    bind:files
    bind:this={inputUploadImage}
    on:change={() => toDataUrl(files[0])}
  />
  <button class="upload-btn" on:click={() => inputUploadImage.click()}>Upload</button>
</div>

<style>
  .hidden {
    display: none;
  }

  .upload-btn {
    width: 128px;
    height: 32px;
    background-color: black;
    font-family: sans-serif;
    color: white;
    font-weight: bold;
    border: none;
  }

  .upload-btn:hover {
    background-color: white;
    color: black;
    outline: black solid 2px;
  }
</style>
