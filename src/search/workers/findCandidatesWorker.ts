const test = async () => {
  const { promise, resolve } = Promise.withResolvers<void>();
  let counter = 0;
  const worker = setInterval(() => {
    if (counter > 10) {
      console.log("Worker: ", "done");
      clearInterval(worker);
      resolve();
    }

    console.log("Worker: ", counter);

    counter++;
  }, 1000);

  return promise;
};

onmessage = async function (messageEvent) {
  switch (messageEvent.data.fn) {
    case "test": {
      await test();
      postMessage({ msg: messageEvent.data.fn });
      break;
    }

    default:
      break;
  }
};
