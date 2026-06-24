@extends('layouts.app')

@section('title', 'Dashboard')

@section('content')
	<main>
		<h1>Dashboard</h1>
		<p>You are logged in.</p>

		<form method="POST" action="{{ route('logout') }}">
			@csrf
			<button type="submit">Log out</button>
		</form>
	</main>
@endsection
