interface Props {
  disablePrev?: boolean;
  disableNext?: boolean;
}

export default function StepMover(props: Props) {
  return (
    <div className="flex flex-row justify-between">
      <button className="btn btn-lg" disabled={props.disablePrev}>
        이전
      </button>
      <button className="btn btn-lg btn-primary" disabled={props.disableNext}>
        다음
      </button>
    </div>
  );
}
