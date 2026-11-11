import React from "react";
import StreamingInfo from "./StreamingInfo";
import BoxOfficeStats from "./BoxOfficeStats";

const MetaInfoPanel = ({ show, streaming, boxOffice }) => (
  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 my-8">
    <StreamingInfo streaming={streaming} link={show["watch/providers"]?.results?.IN?.link} />
    <BoxOfficeStats boxOffice={boxOffice} runtime={show.episode_run_time?.[0]} />
  </div>
);

export default MetaInfoPanel;
