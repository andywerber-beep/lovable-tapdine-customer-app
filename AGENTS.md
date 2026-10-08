<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Demo customer venues live only in `src/lib/demo-venues.ts` and are returned only when no real live offers exist, keeping partner data authoritative and demo removal isolated.
- iOS CI signing takes the Apple team ID from the provisioning profile fastlane downloads, not from the APPLE_TEAM_ID secret — a mistyped secret containing "|" once split the xcodebuild shell command (exit 127).
