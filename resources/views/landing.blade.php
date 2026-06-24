@extends('layouts.app')

@section('title', 'coevta')

@section('content')
	<main>
		<h1>coevta</h1>
		<p>Contacts, Events &amp; Tasks — a minimalist, Google-compatible REST backend.</p>

		@auth
			<a href="{{ url('/dashboard') }}">Dashboard</a>
		@else
			<a href="{{ route('login') }}">Log in</a>
		@endauth
	</main>
@endsection
