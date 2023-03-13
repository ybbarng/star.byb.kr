<script lang="ts">
  var inputUploadImage: HTMLInputElement;
  var files: File[];
  var imageDataUrl: string;
  const toDataUrl = (blob: File) => {
    const reader = new FileReader();
    reader.readAsDataURL(blob);
    reader.onload = (e) => {
      imageDataUrl = e.target.result;
    }
  }
</script>
<h1>천체 이미지 분석</h1>
<p>천체 이미지 분석 페이지입니다.</p>
<div class="container">
    <img id="image" src={imageDataUrl} alt="image to be solved"/>
    <input class="hidden" id="input-upload-image" type="file" accept=".png,.jpg"
      bind:files
      bind:this={inputUploadImage}
      on:change={() => toDataUrl(files[0])}
      />
    <button class="upload-btn" on:click={() => inputUploadImage.click()}>Upload</button>
</div>

<style>
    .container {
        width: 100%;
        min-height: 600px;
        border: 1px black solid;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
    }

    #avatar {
        border-radius: 99999px;
        height: 128px;
        width: 128px;
        margin-bottom: 10px;
    }

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