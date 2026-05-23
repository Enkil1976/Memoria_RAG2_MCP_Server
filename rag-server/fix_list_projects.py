with open('rag_v2_system.py', 'r') as f:
    lines = f.readlines()

# Find the problematic function
start_idx = None
for i, line in enumerate(lines):
    if 'def list_projects(self):' in line:
        start_idx = i
        break

if start_idx is not None:
    # Replace the function with correct indentation
    new_lines = []
    i = 0
    while i < len(lines):
        if i == start_idx:
            # Skip the old function and insert the new one
            new_lines.append('    # ── Listado de proyectos ──────────────────────────────────────────────────\n')
            new_lines.append('    def list_projects(self):\n')
            new_lines.append('        with self.conn.cursor() as cur:\n')
            new_lines.append('            try:\n')
            new_lines.append('                cur.execute("""\n')
            new_lines.append('                    SELECT project_id, COUNT(*) AS mem_count\n')
            new_lines.append('                    FROM memories_v2\n')
            new_lines.append('                    GROUP BY project_id\n')
            new_lines.append('                    ORDER BY mem_count DESC\n')
            new_lines.append('                """)\n')
            new_lines.append('                return [{\"project_id\": r[0], \"memory_count\": r[1]} for r in cur.fetchall()]\n')
            new_lines.append('            except Exception as e:\n')
            new_lines.append('                self.conn.rollback()\n')
            new_lines.append('                raise RuntimeError(f\"[list_projects] Error: {e}\") from e\n')
            # Skip until we pass the old function
            i += 1
            while i < len(lines) and not (lines[i].startswith('    def ') and i > start_idx):
                i += 1
            continue
        new_lines.append(lines[i])
        i += 1
    
    with open('rag_v2_system.py', 'w') as f:
        f.writelines(new_lines)
    print("Fixed list_projects function")
else:
    print("Could not find list_projects function")
