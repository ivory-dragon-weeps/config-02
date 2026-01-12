function escapeCsvField(field) {
    return `"` + String(field ?? "").trim().replace(/"/g, `""`) + `"`;
}

export async function toCSV(objectArray) {
  // Ensures we can actually download stuff 
  await new Promise(res => setTimeout(res, 200));
  document.body.focus();

  // Actual CSV construction
  let header = Object.keys(objectArray[0]);
  let csvHeaders = header.join(',');
  let csvRows = objectArray.map(item => Object.values(item).map(escapeCsvField).join(','));
  let csvBody = csvRows.join("\n");

  // Check the clipboard for previous CSVs
  let previousCsv = await navigator.clipboard.readText();
  // Basically we're trying to recover the original structure
  let [previousHeaders, ...previousBody] = previousCsv.split("\n");
  previousBody = previousBody.join("\n");
  
  // Start building the new CSV
  let csvString = "";
  csvString += csvHeaders;
  // If we've already got a CSV on the clipboard with the same headers,
  // We basically just assume ours is an extension of it
  if (csvHeaders === previousHeaders) {
    csvString += "\n" + previousBody;
  }
  // If ours is already in it, we just ignore ours
  // But if it isn't, we add it
  // And if theirs is totally irrelevant, then ours overwrites theirs.
  if (!previousBody.includes(csvBody)) {
    csvString += "\n" + csvBody;
  }

  console.log(csvString);

  await navigator.clipboard.writeText(csvString);
  // Signal that we're done capturing this page.
  document.body.style = `filter: contrast(0.5) brightness(1.3) sepia(0.9)`
}

export const downloadCsv = (filename) => (text) => Object.assign(document.createElement("a"), {
    href: "data:text/csv;charset=utf-8," + encodeURIComponent(text),
    download: filename
}).click();
