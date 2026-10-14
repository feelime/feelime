package com.feelime.ime

import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class DiagnosticsJsEventTest {
    @Test fun dynamicHeartbeatSurvivesTheOldBridgeLimit() {
        val heartbeat = "heartbeat raf=1 touch=32 cancel=0 blocked=0 noClick=0/0/0 " +
            "pop=1/h@37/5.0s bub=0 press=2 states=32 preedit=2 vr=0 warm=0 comp=1 " +
            "vis=v rev=999999 err=TypeError at popup finalization"
        assertTrue(heartbeat.length > 160)
        val parts = Diagnostics.jsEventParts(heartbeat)
        assertEquals(heartbeat, parts.joinToString(""))
        assertTrue(parts.all { it.length <= 180 })
        assertTrue(parts.last().contains("popup finalization"))
    }

    @Test fun overlongDiagnosticKeepsItsPrefixWithABoundedBudget() {
        val line = "touchFault " + "x".repeat(5000)
        val parts = Diagnostics.jsEventParts(line)
        assertEquals(line.take(Diagnostics.MAX_JS_EVENT_CHARS), parts.joinToString(""))
        assertTrue(parts.first().startsWith("touchFault "))
        assertTrue(parts.all { it.length <= 180 })
    }
}
