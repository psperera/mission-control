#!/usr/bin/env python3
"""
Auto-advance mission phases based on task completion
Run this as a cron job or scheduled task to automatically update phase status
"""

import sqlite3
import json
from pathlib import Path
from datetime import datetime

DB_PATH = Path("/Users/paulperera/dev/mission-control/mission-control.db")

# Phase to task mapping
PHASE_TASK_MAPPING = {
    "esab-eddyfi-waygate-2026": {
        "esab-eddyfi-waygate-2026-phase-1": {
            "name": "Research",
            "task_prefixes": ["S1", "S2", "S3", "S4", "S5", "S6", "R1", "R2", "R3", "R4", "L1"],
            "threshold": 0.8  # 80% of tasks complete to advance phase
        },
        "esab-eddyfi-waygate-2026-phase-2": {
            "name": "Analysis", 
            "task_prefixes": ["R5", "R6", "SC1", "SC2", "SC3", "SC4", "SC5"],
            "threshold": 0.8
        },
        "esab-eddyfi-waygate-2026-phase-3": {
            "name": "Synthesis",
            "task_prefixes": ["W1", "W2", "W3", "W4"],
            "threshold": 0.75
        },
        "esab-eddyfi-waygate-2026-phase-4": {
            "name": "Outputs",
            "task_prefixes": ["C1", "EXEC"],
            "threshold": 1.0  # 100% for final phase
        }
    }
}

def get_phase_task_status(conn, mission_id, phase_id, task_prefixes):
    """Get completion status for tasks in a phase"""
    cursor = conn.cursor()
    
    # Get all tasks for this mission
    cursor.execute("""
        SELECT id, status FROM tasks 
        WHERE business_id = ?
    """, (mission_id.replace("-", "_"),))
    
    tasks = cursor.fetchall()
    
    # Filter tasks by prefix
    phase_tasks = []
    for task_id, status in tasks:
        for prefix in task_prefixes:
            if task_id.startswith(prefix):
                phase_tasks.append((task_id, status))
                break
    
    if not phase_tasks:
        return 0, 0
    
    completed = sum(1 for _, status in phase_tasks if status == 'done')
    total = len(phase_tasks)
    
    return completed, total

def auto_advance_phases():
    """Automatically advance phases based on task completion"""
    conn = sqlite3.connect(DB_PATH)
    cursor = conn.cursor()
    
    updated = []
    
    for mission_id, phases in PHASE_TASK_MAPPING.items():
        for phase_id, phase_config in phases.items():
            # Get current phase status
            cursor.execute("""
                SELECT status FROM mission_phases WHERE id = ?
            """, (phase_id,))
            
            row = cursor.fetchone()
            if not row:
                continue
                
            current_status = row[0]
            
            # Skip if already completed
            if current_status == 'completed':
                continue
            
            # Get task completion for this phase
            completed, total = get_phase_task_status(
                conn, mission_id, phase_id, phase_config["task_prefixes"]
            )
            
            if total == 0:
                continue
            
            completion_rate = completed / total
            threshold = phase_config["threshold"]
            
            print(f"Phase {phase_config['name']}: {completed}/{total} = {completion_rate:.0%} (threshold: {threshold:.0%})")
            
            # Auto-advance if threshold met
            if completion_rate >= threshold and current_status != 'completed':
                cursor.execute("""
                    UPDATE mission_phases 
                    SET status = 'completed', completed_at = datetime('now')
                    WHERE id = ?
                """, (phase_id,))
                
                # Advance to next phase
                next_phase_number = int(phase_id.split('-')[-1]) + 1
                next_phase_id = f"{mission_id}-phase-{next_phase_number}"
                
                cursor.execute("""
                    UPDATE mission_phases 
                    SET status = 'in_progress'
                    WHERE id = ? AND status = 'pending'
                """, (next_phase_id,))
                
                updated.append({
                    'phase': phase_config['name'],
                    'completion': f"{completed}/{total}",
                    'rate': f"{completion_rate:.0%}"
                })
                
                print(f"  ✓ Auto-advanced {phase_config['name']} to completed")
    
    conn.commit()
    conn.close()
    
    return updated

if __name__ == "__main__":
    print(f"🔄 Auto-advancing mission phases...")
    print(f"Time: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print("=" * 60)
    
    updated = auto_advance_phases()
    
    print("=" * 60)
    if updated:
        print(f"✅ Updated {len(updated)} phases")
        for u in updated:
            print(f"   - {u['phase']}: {u['completion']} ({u['rate']})")
    else:
        print("ℹ️  No phases needed advancement")
