# Mobile Floating Actions

## Goal

Remove the permanently occupied mobile publish area and give the message list most of the screen, while keeping connection setup, subscription management, topic filtering, and message publishing quickly accessible.

## Users And Scenarios

- Android App users mainly monitor MQTT messages and only occasionally configure connections or publish messages.
- Users open topic filters with a left-edge swipe or the filter button in the top bar.
- Users open connection settings or the lightweight publisher from one bottom-right floating action button.

## Requirements

- Apply this interaction only to the mobile App layout; keep the desktop layout unchanged.
- Remove the permanently visible mobile publish bar.
- Show one collapsed floating action button above the bottom-right safe area.
- Tapping the main button expands two fan-shaped actions: connection settings and publish message.
- Tapping outside the expanded actions, selecting an action, or pressing Back collapses the actions.
- Connection settings open in a mobile modal and reuse the current connection fields, saved configurations, connect/disconnect controls, and subscription management.
- The former mobile side drawer becomes a topic-filter drawer and no longer contains connection configuration.
- Open the topic-filter drawer by swiping right from the left screen edge or tapping the top-bar filter button; close it by swiping left, tapping outside, or pressing Back.
- The topic-filter drawer supports multiple topic selection, current selection visibility, and clearing all filters without changing actual MQTT subscriptions.
- The publish action opens a lightweight bottom panel containing only Topic, Payload, and Send.
- The publish panel moves above the soft keyboard, preserves draft input while open, and closes after a successful publish.
- Disable Send while disconnected or while Topic is empty; keep the panel open when publishing fails.
- Respect Android top and bottom safe areas for the drawer, floating actions, modals, and bottom panel.

## Not Included

- No desktop layout redesign.
- No MQTT protocol, persistence, or reconnection behavior changes.
- No QoS, Retain, timer, multicast, quick-action, or saved-command controls in the lightweight mobile publish panel.
- No new UI framework, gesture library, or global state library.

## Acceptance Criteria

- On 360px to 430px wide Android viewports, the message list extends to the bottom safe-area region when no overlay is open.
- The collapsed floating button does not cover message controls or system navigation.
- The two expanded actions are fully visible, have distinct icons and accessible labels, and collapse predictably.
- Connection settings and subscription management remain functionally equivalent to the current mobile drawer.
- Topic filters can be opened by gesture and button, support multi-select and clear, and do not alter subscriptions.
- The publish panel shows only Topic, Payload, and Send; all controls remain visible with the soft keyboard open.
- Successful publishing closes the panel; invalid input, disconnection, or publish failure does not lose the draft.
- Android Back closes the topmost mobile overlay before leaving the App.
- Desktop behavior and layout remain unchanged.
- Existing MQTT lifecycle tests and `npm.cmd run verify` pass.

## Open Questions

- None.
