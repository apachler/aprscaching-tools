# Packet decoder

The packet decoder shows every field a raw APRS line carries. It is for operators who want to read a packet field
by field; it decodes in the browser, with no network.

## What it does

You paste a TNC2 monitor line or an APRS-IS line. The decoder answers with a one-line summary, and its panel shows:

- the sender, the destination and the path;
- how the line arrived: heard on RF, or entered over APRS-IS, and through which IGate;
- the packet type;
- every APRS field: position (plain, compressed or Mic-E), course, speed, altitude, objects and items, messages
  with acknowledgements, bulletins, status, weather and telemetry.

It runs the same parser the aprscaching gateway ingests with: the MIT APRS library at the commit `lib.lock` pins.

## Use it

1. In **Tools → Decode**, pick **APRS packet**.
2. Paste a line, or select **Use a sample**:

    ```text
    OE8APR-9>APRS,WIDE1-1,qAR,OE8XXX:!4704.41N/01526.27E>088/036/A=001234Mobile
    ```

3. Select **Decode**.

In the sample, `qAR,OE8XXX` is the q-construct: the station OE8XXX heard the packet on RF and passed it to APRS-IS.

## Permissions

| Permission | Why |
|---|---|
| `decoder` | Adds the **APRS packet** decoder |
| `panel` | Shows the decoded fields |

## Version and tool API

<!-- tool-facts -->

## Next

- [Tool catalogue](index.md): the other decoders.
- [The sandbox API](../write/sandbox-api.md#decoders): how a tool adds a decoder.
