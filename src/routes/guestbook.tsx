import { createAsync, useSubmission } from "@solidjs/router";
import { For, Show, createSignal } from "solid-js";
import PageLayout from "~/components/PageLayout";
import { Spinner } from "~/components/Spinner";
import {
	getEntries,
	getCurrentUser,
	initiateAuthAction,
	logoutAction,
	signGuestbookAction,
} from "~/libs/actions/guestbook";

export default function Guestbook() {
	const entries = createAsync(() => getEntries());
	const currentUser = createAsync(() => getCurrentUser());
	const [message, setMessage] = createSignal("");
	const [handle, setHandle] = createSignal("");
	const authSubmission = useSubmission(initiateAuthAction);
	const signSubmission = useSubmission(signGuestbookAction);
	const logoutSubmission = useSubmission(logoutAction);

	return (
		<PageLayout title="Guestbook" description="Sign my guestbook">
			<h1>Guestbook</h1>

			<div class="max-w-2xl mx-auto">
				<Show
					when={currentUser()}
					fallback={
						<div class="mb-8">
							<p class="mb-4">
								Sign in with your Fediverse account (Mastodon, Pleroma, etc.) to
								leave a message.
							</p>
							<p class="mb-3 text-sm">
								Enter your full Fediverse handle (e.g., user@mastodon.social or
								user@fosstodon.org). Certain instances and Mastodon forks like
								Hometown don't work that well sorry :(
							</p>
							<Show when={authSubmission.error}>
								<div class="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-sm">
									{authSubmission.error.message}
								</div>
							</Show>
							<form action={initiateAuthAction} method="post">
								<div class="flex gap-2">
									<input
										type="text"
										name="handle"
										placeholder="user@mastodon.social"
										value={handle()}
										onInput={(e) => setHandle(e.currentTarget.value)}
										required
										pattern="[^@]+@[^@]+"
										title="Enter your Fediverse handle in the format: user@instance.social"
										disabled={authSubmission.pending}
										class="flex-1 px-4 py-2 border "
									/>
									<button
										type="submit"
										disabled={authSubmission.pending}
										class="px-6 py-2 bg-black hover:bg-[#cc0081] text-white cursor-pointer transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
									>
										{authSubmission.pending ? "Connecting..." : "Sign in"}
									</button>
								</div>
							</form>
						</div>
					}
				>
					{(user) => (
						<div class="mb-8">
							<div class="flex items-center justify-between mb-4">
								<div class="flex items-center gap-3">
									<img
										src={user().avatar_url}
										alt={user().display_name}
										class="w-12 h-12 rounded-full"
									/>
									<div>
										<div class="font-semibold">{user().display_name}</div>
										<div class="text-sm text-gray-600">
											@{user().username}@{user().instance}
										</div>
									</div>
								</div>
								<form action={logoutAction} method="post">
									<button
										type="submit"
										disabled={logoutSubmission.pending}
										class="px-4 py-1.5 text-sm border border-gray-300 cursor-pointer hover:bg-[#f8d7da] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
									>
										{logoutSubmission.pending ? "Logging out..." : "Logout"}
									</button>
								</form>
							</div>
							<Show when={signSubmission.result?.success}>
								<div class="mb-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
									Thank you for signing the guestbook!
								</div>
							</Show>
							<Show when={signSubmission.error}>
								<div class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
									{signSubmission.error.message}
								</div>
							</Show>
							<form action={signGuestbookAction} method="post">
								<textarea
									name="message"
									placeholder="Leave your message here..."
									value={message()}
									onInput={(e) => setMessage(e.currentTarget.value)}
									required
									maxLength={500}
									disabled={signSubmission.pending}
									class="w-full px-4 py-2 border min-h-32 mb-2 disabled:opacity-50"
								/>
								<div class="flex justify-between items-center">
									<span class="text-sm text-gray-500">
										{message().length}/500
									</span>
									<button
										type="submit"
										disabled={signSubmission.pending}
										class="px-6 py-2 bg-black text-white cursor-pointer hover:bg-[#cc0081] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
									>
										{signSubmission.pending ? "Signing..." : "Sign guestbook"}
									</button>
								</div>
							</form>
						</div>
					)}
				</Show>

				<div class="space-y-4">
					<h2 class="mb-4">Signatures</h2>
					<Show
						when={entries() && entries()!.length > 0}
						fallback={<Spinner />}
					>
						<For each={entries()}>
							{(entry) => (
								<div class="p-4 border border-gray-200 rounded-lg">
									<div class="flex items-start gap-3">
										<Show when={entry.avatar_url}>
											<img
												src={entry.avatar_url!}
												alt={entry.display_name ?? entry.fediverse_username}
												class="w-10 h-10 rounded-full"
											/>
										</Show>
										<div class="flex-1">
											<div class="flex items-baseline gap-2 mb-1">
												<span class="font-semibold">
													{entry.display_name ?? entry.fediverse_username}
												</span>
												<span class="text-sm text-gray-500">
													{entry.fediverse_username}
												</span>
											</div>
											<p class="text-gray-700 mb-2">{entry.message}</p>
											<time class="text-xs text-gray-500">
												{new Date(entry.created_at).toLocaleDateString(
													"en-NZ",
													{
														year: "numeric",
														month: "long",
														day: "numeric",
														hour: "2-digit",
														minute: "2-digit",
													},
												)}
											</time>
										</div>
									</div>
								</div>
							)}
						</For>
					</Show>
				</div>
			</div>
		</PageLayout>
	);
}
