package com.feelime.ime

import java.io.File
import kotlin.random.Random
import org.json.JSONArray
import org.junit.Assert.*
import org.junit.Test

class InkBridgeDecimationTest {
    @Test fun `real JS payload then native decimation matches native-only point sequence and features`() {
        val random = Random(84)
        val sizes = listOf(listOf(1), listOf(2, 1, 3), List(6) { 84 },
            listOf(189, 89, 61, 173, 23, 97, 2, 2, 114, 4, 6, 174, 50, 25, 96, 164, 110),
            List(64) { 2 }, listOf(512, 1)) + List(40) { List(random.nextInt(1, 33)) { random.nextInt(1, 513) } }
        val cases = sizes.map { strokes -> strokes.map { count ->
            List(count) { HandwritingInk.InkPoint(random.nextInt(3200) / 10f, random.nextInt(1320) / 10f) }
        } }
        val input = JSONArray(cases.map { strokes -> strokes.map { stroke -> stroke.map { listOf(it.x, it.y) } } })
        val root = generateSequence(File(checkNotNull(System.getProperty("user.dir")))) { it.parentFile }
            .first { File(it, "scripts/verify/ink_decimation_probe.js").isFile }
        val process = ProcessBuilder("node", "scripts/verify/ink_decimation_probe.js").directory(root).start()
        process.outputStream.bufferedWriter().use { it.write(input.toString()) }
        val output = process.inputStream.bufferedReader().readText()
        val errors = process.errorStream.bufferedReader().readText()
        assertEquals(errors, 0, process.waitFor())
        val payloads = JSONArray(output)
        cases.forEachIndexed { i, original ->
            val payload = payloads.getJSONObject(i).toString()
            assertTrue("case $i chars=${payload.length}", payload.length <= HandwritingInk.MAX_PAYLOAD_CHARS)
            val request = checkNotNull(HandwritingInk.parseInkRequest(payload))
            val expected = OchwproInk.decimate(original, OchwproEngine.DENSITY_CAP)
            val actual = OchwproInk.decimate(request.strokes, OchwproEngine.DENSITY_CAP, request.originalStrokeSizes)
            assertEquals("case $i", expected, actual)
            assertArrayEquals(OchwproInk.strokesToSequence(expected), OchwproInk.strokesToSequence(actual), 0f)
        }
    }

    @Test fun `invalid reduced point counts cannot bypass native density validation`() {
        val strokes = listOf(List(100) { HandwritingInk.InkPoint(it.toFloat(), 0f) })
        try {
            OchwproInk.decimate(strokes, 48, listOf(100))
            fail("forged metadata accepted")
        } catch (_: IllegalArgumentException) { }
    }
}
