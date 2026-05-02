export const exportReportCSV = (students) => {
  const escapeCSV = (value) => {
    if (typeof value === 'string') {
      return `"${value.replace(/"/g, '""')}"`;
    }
    return value;
  };

  const rows = students.map(student => [
    escapeCSV(student.id),
    escapeCSV(student.name),
    escapeCSV(student.math),
    escapeCSV(student.english),
    escapeCSV(student.science),
    student.mean ? escapeCSV(student.mean.toFixed(2)) : "",
    escapeCSV(student.rubric)
  ].join(","));

  const csvContent = "data:text/csv;charset=utf-8," + "ID,Name,Math,English,Science,Mean,Rubric\n" + rows.join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "student_marklist.csv");
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link); // Clean up the DOM
};