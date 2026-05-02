import React from 'react';

const ReportPreview = ({ students }) => {
  // Use letterhead settings from localStorage, or default values
  const storedLetterhead = localStorage.getItem('letterhead');
  const letterhead = storedLetterhead
    ? JSON.parse(storedLetterhead)
    : {
        logoUrl: 'logschool.png',
        schoolName: 'Spring Valley Baptist Children Centre & School',
        address: 'Kayole Junction, Embakasi Central, Nairobi, Kenya',
        phone: '+254 722 356 416'
      };

  // Get class name from the first student (if available)
  const className = students.length > 0 && students[0].class ? students[0].class : '';

  return (
    <div style={{ marginTop: '2em', padding: '1em', border: '1px solid #ccc' }}>
      <div style={{ textAlign: 'center', marginBottom: '2em' }}>
        {letterhead.logoUrl && letterhead.logoUrl !== 'Letterhead.png' && (
          <img 
            src={letterhead.logoUrl} 
            alt="Logo" 
            style={{ width: '100px', marginBottom: '1em' }} 
          />
        )}
        <h2>{letterhead.schoolName}</h2>
        <p>{letterhead.address} | {letterhead.phone}</p>
      </div>
      <h3>Class Marklist{className && ` - ${className}`}</h3>
      <table style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead style={{ backgroundColor: '#f5f5f5' }}>
          <tr>
            <th style={{ border: '1px solid #ccc', padding: '8px' }}>Name</th>
            <th style={{ border: '1px solid #ccc', padding: '8px' }}>Math</th>
            <th style={{ border: '1px solid #ccc', padding: '8px' }}>English</th>
            <th style={{ border: '1px solid #ccc', padding: '8px' }}>Science</th>
            <th style={{ border: '1px solid #ccc', padding: '8px' }}>Mean</th>
            <th style={{ border: '1px solid #ccc', padding: '8px' }}>Rubric</th>
            <th style={{ border: '1px solid #ccc', padding: '8px' }}>Class</th>
          </tr>
        </thead>
        <tbody>
          {students.map(student => (
            <tr key={student.id || student._id}>
              <td style={{ border: '1px solid #ccc', padding: '8px' }}>{student.name || '-'}</td>
              <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>
                {student.math !== null ? student.math : '-'}
              </td>
              <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>
                {student.english !== null ? student.english : '-'}
              </td>
              <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>
                {student.science !== null ? student.science : '-'}
              </td>
              <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>
                {student.mean !== null ? student.mean.toFixed(2) : '-'}
              </td>
              <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>
                {student.rubric || '-'}
              </td>
              <td style={{ border: '1px solid #ccc', padding: '8px', textAlign: 'center' }}>
                {student.class || '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ReportPreview;