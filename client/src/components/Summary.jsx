export default function Summary({ s }) {
  if (!s) return null;

  if (s.readable === false) {
    return <div className="note err">{s.plain_summary}</div>;
  }

  return (
    <div className="summary">
      <div>
        <h3>{s.document_type}</h3>
        <p>{s.plain_summary}</p>
      </div>

      {s.key_information?.length > 0 && (
        <div>
          <h3>Key information</h3>
          <dl>
            {s.key_information.map((k, i) => (
              <div key={i} style={{ display: 'contents' }}>
                <dt>{k.label}</dt>
                <dd>{k.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      )}

      {s.values_outside_range?.length > 0 && (
        <div>
          <h3>Results marked outside the normal range</h3>
          {s.values_outside_range.map((v, i) => (
            <p className="flag" key={i}>
              <strong>{v.name}: {v.value}</strong> (range: {v.reference_range}). {v.note}
            </p>
          ))}
        </div>
      )}

      {s.questions_for_doctor?.length > 0 && (
        <div>
          <h3>Questions you could ask your doctor</h3>
          <ul>
            {s.questions_for_doctor.map((q, i) => <li key={i}>{q}</li>)}
          </ul>
        </div>
      )}

      <p className="disclaimer">{s.disclaimer}</p>
    </div>
  );
}