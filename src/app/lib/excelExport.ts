import * as XLSX from 'xlsx';
import type { GridSnapshot } from '../context/GridContext';

export function exportGridsToExcel(
  grid1Snap: GridSnapshot,
  grid2Snap: GridSnapshot,
  weekKey: string,
  fileName: string = 'Quality_Scores.xlsx'
) {
  const wb = XLSX.utils.book_new();

  // Helper to convert snap to sheet
  const convertSnapToSheet = (snap: GridSnapshot, label: string) => {
    const aoa: any[][] = [];
    
    // Title
    aoa.push([label, `Week: ${weekKey}`]);
    aoa.push([]); // blank

    // Row 2 (headerRow1)
    const headerRow1: string[] = ['Agent'];
    snap.metaCols.forEach(col => {
      headerRow1.push(col.name);
    });

    snap.groups.forEach(g => {
      const paramsInGroup = snap.scoreParams.filter(p => p.groupId === g.id);
      const count = paramsInGroup.length || 1;
      headerRow1.push(g.name);
      for (let i = 1; i < count; i++) {
        headerRow1.push('');
      }
    });

    headerRow1.push('Total');
    headerRow1.push('Percentage');

    if (snap.manualParams.length > 0) {
      headerRow1.push('Additional Info');
      for (let i = 1; i < snap.manualParams.length; i++) {
        headerRow1.push('');
      }
    }
    aoa.push(headerRow1);

    // Row 3 (headerRow2)
    const headerRow2: string[] = [''];
    snap.metaCols.forEach(() => {
      headerRow2.push('');
    });

    snap.groups.forEach(g => {
      const paramsInGroup = snap.scoreParams.filter(p => p.groupId === g.id);
      if (paramsInGroup.length === 0) {
        headerRow2.push('No columns');
      } else {
        paramsInGroup.forEach(p => {
          headerRow2.push(`${p.name} [${p.score}]`);
        });
      }
    });

    headerRow2.push('');
    headerRow2.push('');

    snap.manualParams.forEach(p => {
      headerRow2.push(p.name);
    });
    aoa.push(headerRow2);

    // Data rows
    const visibleRows = snap.rows.filter(r => r.weekKey === weekKey);
    const globalMax = snap.scoreParams.reduce((s, p) => s + p.score, 0);

    visibleRows.forEach(row => {
      const dataRow: any[] = [row.agentName || 'Unnamed'];
      
      // Meta values
      snap.metaCols.forEach(col => {
        dataRow.push(row.metaValues[col.id] || '');
      });
      
      // Scores
      snap.groups.forEach(g => {
        const paramsInGroup = snap.scoreParams.filter(p => p.groupId === g.id);
        if (paramsInGroup.length === 0) {
          dataRow.push('');
        } else {
          paramsInGroup.forEach(p => {
            const checked = row.checked[p.id];
            dataRow.push(checked ? p.score : 0);
          });
        }
      });
      
      // Total & Percentage
      const total = snap.scoreParams.reduce((s, p) => s + (row.checked[p.id] ? p.score : 0), 0);
      const pct = globalMax === 0 ? 0 : Math.round((total / globalMax) * 100);
      
      dataRow.push(total);
      dataRow.push(`${pct}%`);
      
      // Manual values
      snap.manualParams.forEach(p => {
        dataRow.push(row.manualValues[p.id] || '');
      });
      
      aoa.push(dataRow);
    });

    // Totals row at the bottom
    const totalRow: any[] = ['Column Totals'];
    snap.metaCols.forEach(() => {
      totalRow.push('');
    });

    snap.groups.forEach(g => {
      const paramsInGroup = snap.scoreParams.filter(p => p.groupId === g.id);
      if (paramsInGroup.length === 0) {
        totalRow.push('');
      } else {
        paramsInGroup.forEach(p => {
          const ct = visibleRows.reduce((s, r) => s + (r.checked[p.id] ? p.score : 0), 0);
          totalRow.push(ct);
        });
      }
    });

    const grandTotal = visibleRows.reduce((s, r) => {
      return s + snap.scoreParams.reduce((sum, p) => sum + (r.checked[p.id] ? p.score : 0), 0);
    }, 0);
    const grandTotalMax = visibleRows.length * globalMax;
    const grandTotalPct = grandTotalMax === 0 ? 0 : Math.round((grandTotal / grandTotalMax) * 100);

    totalRow.push(grandTotal);
    totalRow.push(`${grandTotalPct}%`);

    snap.manualParams.forEach(() => {
      totalRow.push('');
    });
    aoa.push(totalRow);

    const ws = XLSX.utils.aoa_to_sheet(aoa);

    // Apply merges
    const merges: XLSX.Range[] = [];

    // Title merge
    merges.push({ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } });

    // Agent merge (row index 2 and 3, col index 0)
    merges.push({ s: { r: 2, c: 0 }, e: { r: 3, c: 0 } });

    // Meta columns merges (row index 2 and 3, col index i)
    for (let i = 1; i <= snap.metaCols.length; i++) {
      merges.push({ s: { r: 2, c: i }, e: { r: 3, c: i } });
    }

    // Score groups and params merges
    let colIdx = 1 + snap.metaCols.length;
    snap.groups.forEach(g => {
      const paramsInGroup = snap.scoreParams.filter(p => p.groupId === g.id);
      const count = paramsInGroup.length || 1;
      if (count > 1) {
        merges.push({ s: { r: 2, c: colIdx }, e: { r: 2, c: colIdx + count - 1 } });
      }
      colIdx += count;
    });

    // Total and Percentage merges
    const totalColIdx = colIdx;
    merges.push({ s: { r: 2, c: totalColIdx }, e: { r: 3, c: totalColIdx } });

    const pctColIdx = totalColIdx + 1;
    merges.push({ s: { r: 2, c: pctColIdx }, e: { r: 3, c: pctColIdx } });

    colIdx = pctColIdx + 1;

    // Manual columns merge
    if (snap.manualParams.length > 1) {
      merges.push({ s: { r: 2, c: colIdx }, e: { r: 2, c: colIdx + snap.manualParams.length - 1 } });
    }

    ws['!merges'] = merges;

    // Optional styling/col width calculations
    const wscols = [{ wch: 20 }]; // Agent column width
    snap.metaCols.forEach(() => wscols.push({ wch: 15 }));
    snap.groups.forEach(g => {
      const count = snap.scoreParams.filter(p => p.groupId === g.id).length || 1;
      for (let i = 0; i < count; i++) wscols.push({ wch: 15 });
    });
    wscols.push({ wch: 10 }); // Total
    wscols.push({ wch: 10 }); // %
    snap.manualParams.forEach(() => wscols.push({ wch: 20 }));
    ws['!cols'] = wscols;

    return ws;
  };

  const ws1 = convertSnapToSheet(grid1Snap, grid1Snap.label || 'Grid 1');
  const ws2 = convertSnapToSheet(grid2Snap, grid2Snap.label || 'Grid 2');

  XLSX.utils.book_append_sheet(wb, ws1, (grid1Snap.label || 'Grid 1').substring(0, 31));
  XLSX.utils.book_append_sheet(wb, ws2, (grid2Snap.label || 'Grid 2').substring(0, 31));

  XLSX.writeFile(wb, fileName);
}
